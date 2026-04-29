import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import teamHeroImage from "@/assets/team-hero.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center bg-gradient-subtle overflow-hidden animate-fade-in">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={teamHeroImage}
          alt="Professional Team"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/50"></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
              <CheckCircle className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium">Trusted Since 2015</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Transforming
              <span className="block text-secondary">Financial Futures</span>
              <span className="block">With Integrity</span>
            </h1>
            
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Truemarc Consultants pioneers credit repair solutions, dedicated to removing defaults, judgments, and bad payment profiles. We restore your financial dignity with personalized, transparent solutions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link to="/contact" className="w-full sm:w-auto">
                <Button variant="cta" size="lg" className="group w-full">
                  Get Free Credit Assessment
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/about" className="w-full sm:w-auto">
                <Button variant="professional" size="lg" className="bg-white/10 border-white/30 text-white hover:bg-white hover:text-primary w-full">
                  Learn More About Us
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary mb-1">9+</div>
                <div className="text-sm text-white/80">Years Experience</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary mb-1">1000+</div>
                <div className="text-sm text-white/80">Clients Helped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary mb-1">100%</div>
                <div className="text-sm text-white/80">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Right side content can be added here if needed */}
          <div className="hidden lg:block">
            {/* This space can be used for additional elements or kept minimal */}
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background/50 to-transparent"></div>
    </section>
  );
};

export default Hero;