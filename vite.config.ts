import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// SITE_URL lives in src/lib/site.ts. Read it as text (an import would restart the dev server on every edit there).
const SITE_URL = (fs.readFileSync(path.resolve(__dirname, "src/lib/site.ts"), "utf8").match(/SITE_URL\s*=\s*['"]([^'"]+)['"]/) ?? [])[1] ?? "https://truemarc.co.za";

/**
 * Dev-only stand-in for the production lead endpoint (public/api/lead.php).
 * POST /api/lead.php → appends the lead to .leads/leads.jsonl and answers like the real endpoint.
 * Set VITE_LEAD_FAIL=1 to rehearse the failure path (WhatsApp fallback).
 */
function devLeadCapture(): Plugin {
  return {
    name: "dev-lead-capture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/lead.php", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let raw = "";
        req.on("data", (c) => { raw += c; });
        req.on("end", () => {
          res.setHeader("Content-Type", "application/json");
          if (process.env.VITE_LEAD_FAIL) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: "rehearsal" })); return; }
          try {
            const lead = JSON.parse(raw);
            if (lead.website) { res.end(JSON.stringify({ ok: true })); return; }
            const id = `dev-${Date.now().toString(36)}`;
            const dir = path.resolve(__dirname, ".leads");
            fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(path.join(dir, "leads.jsonl"), JSON.stringify({ id, ...lead }) + "\n");
            server.config.logger.info(`\x1b[32m[lead]\x1b[0m ${lead.firstName} ${lead.phone} · ${lead.situation ?? "-"} · ${lead.source}`);
            setTimeout(() => res.end(JSON.stringify({ ok: true, id })), 450);
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "bad_json" }));
          }
        });
      });
    },
  };
}

/** /__shot?u=/route&w=390&h=3000 wraps a route in an iframe so headless Chrome can render a true mobile width (dev + preview). */
function shotFrame(): Plugin {
  const handler = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) => {
    const q = new URL(req.url ?? "", "http://x").searchParams;
    const u = (q.get("u") || "/").replace(/"/g, "");
    const w = Number(q.get("w") || 390), h = Number(q.get("h") || 3000);
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html><body style="margin:0"><iframe src="${u}" width="${w}" height="${h}" style="border:0;display:block"></iframe></body></html>`);
  };
  return {
    name: "shot-frame",
    configureServer(server) { server.middlewares.use("/__shot", handler); },
    configurePreviewServer(server) { server.middlewares.use("/__shot", handler); },
  };
}

/**
 * `vite preview` = production behaviour of public/.htaccess: /about → dist/about/index.html, /about/ → 301 /about,
 * unknown paths → dist/404.html with a 404 status (Vite's default would serve the home page for everything).
 */
function previewPrerendered(): Plugin {
  return {
    name: "preview-prerendered",
    configurePreviewServer(server) {
      const dist = path.resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = new URL(req.url ?? "/", "http://x");
        let p: string;
        try { p = decodeURIComponent(url.pathname); } catch { return next(); }
        if (p.startsWith("/__shot") || path.extname(p)) return next();
        if (p !== "/" && p.endsWith("/")) { res.statusCode = 301; res.setHeader("Location", p.replace(/\/+$/, "") + url.search); res.end(); return; }
        const file = path.join(dist, p, "index.html");
        const send = (f: string, status: number) => { res.statusCode = status; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(fs.readFileSync(f)); };
        if (file.startsWith(dist) && fs.existsSync(file)) return send(file, 200);
        if (fs.existsSync(path.join(dist, "404.html"))) return send(path.join(dist, "404.html"), 404);
        next();
      });
    },
  };
}

/** index.html: __SITE_URL__ → absolute origin, so og:image etc. work for WhatsApp/Facebook (they ignore relative URLs). */
function absoluteMetaUrls(siteUrl: string): Plugin {
  return { name: "absolute-meta-urls", transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl) };
}

/**
 * Optional analytics, injected only into production builds and only when the ID is set:
 *   VITE_GTM_ID=GTM-XXXXXXX       Google Tag Manager (track() in src/lib/leads.ts pushes to dataLayer)
 *   VITE_META_PIXEL_ID=1234567890 Meta Pixel (generate_lead → fbq('track','Lead'))
 * The queues (dataLayer / fbq) exist immediately so no event is lost; the vendor scripts themselves load after
 * window "load" so they never compete with the page for bandwidth on slow mobile data.
 */
function analytics(env: Record<string, string>): Plugin {
  const gtm = (env.VITE_GTM_ID || "").trim();
  const pixel = (env.VITE_META_PIXEL_ID || "").trim();
  if (gtm && !/^GTM-[A-Z0-9]+$/.test(gtm)) throw new Error(`VITE_GTM_ID looks wrong: "${gtm}" (expected GTM-XXXXXXX)`);
  if (pixel && !/^\d{6,20}$/.test(pixel)) throw new Error(`VITE_META_PIXEL_ID looks wrong: "${pixel}" (expected digits)`);
  const later = (fn: string) => `(function(){var go=function(){${fn}};if(document.readyState==='complete')setTimeout(go,0);else addEventListener('load',function(){setTimeout(go,0)})})();`;
  return {
    name: "optional-analytics",
    apply: "build",
    transformIndexHtml() {
      const tags: { tag: string; attrs?: Record<string, string>; children?: string; injectTo: "head" | "body-prepend" }[] = [];
      if (gtm) {
        tags.push({
          tag: "script",
          children:
            `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});` +
            later(`var j=document.createElement('script');j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id=${gtm}';document.head.appendChild(j);`),
          injectTo: "head",
        });
        tags.push({
          tag: "noscript",
          children: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          injectTo: "body-prepend",
        });
      }
      if (pixel) {
        tags.push({
          tag: "script",
          children:
            `!function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window);` +
            `fbq('init','${pixel}');fbq('track','PageView');` +
            later(`var t=document.createElement('script');t.async=true;t.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(t);`),
          injectTo: "head",
        });
        tags.push({
          tag: "noscript",
          children: `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixel}&amp;ev=PageView&amp;noscript=1" />`,
          injectTo: "body-prepend",
        });
      }
      return tags;
    },
  };
}

export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = (env.VITE_SITE_URL || SITE_URL).replace(/\/$/, "");
  return {
    server: {
      host: "::",
      port: 8080,
    },
    preview: {
      port: 4173,
    },
    plugins: [react(), devLeadCapture(), shotFrame(), previewPrerendered(), absoluteMetaUrls(siteUrl), analytics(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      // Shared vendor code in its own long-cached chunk; page code changes don't bust it.
      rollupOptions: isSsrBuild ? {} : {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (/[\\/](gsap|@gsap|lenis|motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "motion";
            if (/[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run|react-helmet-async|react-fast-compare|invariant|shallowequal)[\\/]/.test(id)) return "react";
            return undefined;
          },
        },
      },
    },
    ssr: {
      // The prerender bundle inlines dependencies so Node never has to load gsap/lenis' browser-flavoured ESM.
      noExternal: true,
    },
  };
});
