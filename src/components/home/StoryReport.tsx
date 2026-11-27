import { Check } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Icon from '@/components/Icon'
import { DESKTOP_STORY, type ExtraScenes } from '@/lib/motion'
import AssessLink from './AssessLink'
import { LISTINGS } from './content'

/**
 * "From blacklisted to back in the green": a sample credit report whose negative listings are struck off
 * one by one while the brand ring, used as a gauge, sweeps from red to green, ending on "Approved".
 *
 * The markup's default state is the END state (all cleared), so the section reads correctly without JS,
 * with reduced motion, and in the stacked mobile layout. GSAP rewinds it to "before" and then:
 *  - desktop with motion (DESKTOP_STORY): pins the section and scrubs the story with the scroll;
 *  - smaller screens with motion: plays it once, time-based, when the report scrolls into view.
 */
export default function StoryReport() {
  return (
    <section className="home-story" aria-labelledby="story-title">
      <div className="home-story__pin">
        <div className="wrap home-story__grid">
          <header className="home-story__head">
            <h2 id="story-title" className="h2">From blacklisted to <span className="home-story__green">back in the green.</span></h2>
            <p className="home-story__intro">We go through your record listing by listing, and challenge what shouldn’t be there.</p>
          </header>

          <ol className="home-story__chapters">
            {LISTINGS.map((l) => (
              <li className="home-story__chapter" key={l.name}>
                <span className="home-story__tick" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
              </li>
            ))}
            <li className="home-story__chapter home-story__chapter--end">
              <h3>Ready to see what’s on yours?</h3>
              <p>Start with a free assessment. A consultant takes it from there.</p>
              <AssessLink placement="home-story">Start my free assessment</AssessLink>
            </li>
          </ol>

          <figure className="home-story__visual">
            <div className="home-report">
              <div className="home-report__head">
                <span className="home-report__title">Credit report</span>
                <span className="home-report__tag">Sample</span>
              </div>
              <div className="home-report__summary">
                <div className="home-report__gauge">
                  <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
                    <circle className="home-report__arc home-report__arc--red" cx="100" cy="100" r="88" pathLength={100} />
                    <circle className="home-report__arc home-report__arc--green" cx="100" cy="100" r="88" pathLength={100} />
                  </svg>
                  <span className="home-report__score">
                    <b className="home-report__count">0</b>
                    <small>negative<br />listings</small>
                  </span>
                </div>
                <div className="home-report__verdict" aria-hidden="true">
                  <span className="home-report__stamp home-report__stamp--no">Declined</span>
                  <span className="home-report__stamp home-report__stamp--yes">Approved</span>
                </div>
              </div>
              <ul className="home-report__rows">
                {LISTINGS.map((l) => (
                  <li className="home-report__row" key={l.name}>
                    <span className="home-report__icon"><Icon name={l.icon} size={18} strokeWidth={1.9} /></span>
                    <span className="home-report__label">
                      <b>{l.name}<i className="home-report__strike" aria-hidden="true" /></b>
                      <small>{l.sub}</small>
                    </span>
                    <span className="home-report__pill">
                      <span className="home-report__pill-no">Listed</span>
                      <span className="home-report__pill-yes"><Check size={13} strokeWidth={3.2} aria-hidden="true" />Cleared</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="home-story__fine">Illustration only. Every credit record is different, and no honest consultant can promise a removal.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}

/** Builds the before → after sequence on a timeline. `hold` adds scroll "rest" between beats (scrubbed version). */
function buildStory(tl: gsap.core.Timeline, q: (sel: string) => HTMLElement[], hold: number) {
  const rows = q('.home-report__row')
  const strikes = q('.home-report__strike')
  const texts = rows.map((r) => Array.from(r.querySelectorAll<HTMLElement>('.home-report__label b, .home-report__label small')))
  const pillNo = q('.home-report__pill-no')
  const pillYes = q('.home-report__pill-yes')
  const arc = q('.home-report__arc--green')
  const count = q('.home-report__count')[0]
  const stampNo = q('.home-report__stamp--no')
  const stampYes = q('.home-report__stamp--yes')
  const n = rows.length

  const setCount = (v: number) => { if (count) count.textContent = String(v) }

  rows.forEach((row, i) => {
    const at = `beat${i}`
    tl.addLabel(at)
    tl.to(row, { '--hl': 1, duration: 0.3 }, at)
    tl.to(strikes[i], { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, `${at}+=0.2`)
    tl.to(texts[i], { opacity: 0.5, duration: 0.4 }, `${at}+=0.45`)
    tl.to(pillNo[i], { autoAlpha: 0, duration: 0.25 }, `${at}+=0.5`)
    tl.fromTo(pillYes[i], { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)', immediateRender: false }, `${at}+=0.55`)
    tl.to(arc, { strokeDashoffset: 100 * (1 - (i + 1) / n), duration: 0.7, ease: 'power2.inOut' }, `${at}+=0.3`)
    // Count down 4 → 3 → 2 → 1 → 0 (works in both scroll directions).
    tl.call(setCount, [n - i], `${at}+=0.5`)
    tl.call(setCount, [n - i - 1], `${at}+=0.51`)
    tl.to(row, { '--hl': 0, duration: 0.3 }, `${at}+=0.9`)
    if (hold) tl.to({}, { duration: hold })
  })
  tl.addLabel('final')
  tl.to(stampNo, { autoAlpha: 0, scale: 0.8, duration: 0.3 }, 'final')
  tl.fromTo(stampYes, { autoAlpha: 0, scale: 1.6, rotate: -18 }, { autoAlpha: 1, scale: 1, rotate: -8, duration: 0.5, ease: 'back.out(1.8)', immediateRender: false }, 'final+=0.15')
  tl.fromTo(q('.home-report__gauge'), { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: 'power1.inOut', immediateRender: false }, '<')
}

/** Puts the report in its "before" state (red ring, four listings, Declined). */
function setBefore(q: (sel: string) => HTMLElement[]) {
  const count = q('.home-report__count')[0]
  if (count) count.textContent = String(q('.home-report__row').length)
  gsap.set(q('.home-report__strike'), { scaleX: 0 })
  gsap.set(q('.home-report__label b, .home-report__label small'), { opacity: 1 })
  gsap.set(q('.home-report__pill-no'), { autoAlpha: 1 })
  gsap.set(q('.home-report__pill-yes'), { autoAlpha: 0 })
  gsap.set(q('.home-report__arc--green'), { strokeDashoffset: 100 })
  gsap.set(q('.home-report__stamp--no'), { autoAlpha: 1, scale: 1 })
  gsap.set(q('.home-report__stamp--yes'), { autoAlpha: 0 })
}

export const storyScene: ExtraScenes = (mm, q) => {
  // Desktop: pinned and scrubbed. Chapters stack in one cell (CSS mirrors DESKTOP_STORY) and swap in step.
  mm.add(DESKTOP_STORY, () => {
    const section = q('.home-story')[0]
    const pin = q('.home-story__pin')[0]
    if (!section || !pin) return
    const chapters = q('.home-story__chapter')
    setBefore(q)
    gsap.set(chapters.slice(1), { autoAlpha: 0, y: 40 })
    gsap.set(q('.home-story__tick'), { scale: 0 })

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${window.innerHeight * 3.4}`,
        pin,
        scrub: 0.7,
        anticipatePin: 1,
        refreshPriority: 1, // measure this pin before the reveal triggers further down the page
      },
    })
    tl.to({}, { duration: 0.3 })
    buildStory(tl, q, 0.5)
    // Chapter copy follows the beats: each listing's chapter shows while its row is being cleared.
    const ticks = q('.home-story__tick')
    chapters.forEach((ch, i) => {
      if (i < ticks.length) tl.to(ticks[i], { scale: 1, duration: 0.3, ease: 'back.out(2)' }, `beat${i}+=0.55`)
      if (i === 0) return
      const at = i < chapters.length - 1 ? `beat${i}` : 'final'
      tl.to(chapters[i - 1], { autoAlpha: 0, y: -40, duration: 0.35 }, `${at}-=0.3`)
      tl.to(ch, { autoAlpha: 1, y: 0, duration: 0.35 }, `${at}-=0.12`)
    })
    tl.to({}, { duration: 0.6 })
    ScrollTrigger.sort()
    const reset = () => { const c = q('.home-report__count')[0]; if (c) c.textContent = '0' }

    return reset
  })

  // Phones/tablets with motion: no pin. Play the story once when the report comes into view.
  mm.add('(max-width: 959px) and (prefers-reduced-motion: no-preference)', () => {
    const report = q('.home-report')[0]
    if (!report) return
    setBefore(q)
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })
    buildStory(tl, q, 0)
    tl.timeScale(1.15)
    ScrollTrigger.create({ trigger: report, start: 'top 72%', once: true, onEnter: () => { tl.play() } })
    return () => { const c = q('.home-report__count')[0]; if (c) c.textContent = '0' }
  })
}
