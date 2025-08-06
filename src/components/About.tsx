import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Target, Heart, Users } from "lucide-react";
import consultantMaleImage from "@/assets/consultant-male.jpg";

const About = () => {
  return (
    <section id="about" className="py-20 bg-gradient-subtle">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            About <span className="text-primary">Truemarc Consultants</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Established in 2015, we are South Africa's leading credit repair specialists, 
            dedicated to restoring financial dignity and creating brighter financial futures.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          {/* Left: Image */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl shadow-elegant">
              <img 
                src={consultantMaleImage}
                alt="Professional Consultant"
                className="w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
            </div>
            {/* Floating Stats Card */}
            <Card className="absolute -bottom-8 -right-8 bg-white shadow-elegant border-0">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">9+</div>
                  <div className="text-sm text-muted-foreground">Years of Excellence</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Content */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Transforming Financial Futures with Integrity and Personalized Solutions
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Welcome to Truemarc Consultants, the pioneers in credit repair solutions dedicated to transforming your financial future. 
                We are a well-established leading consulting company that has assisted thousands of people who are bank declined (blacklisted).
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Our complex experience in providing blacklist solutions has enabled us to restore our clients' dignity by providing 
                solutions to their financial needs. We specialize in helping those who have been declined for credit, home loans, 
                and car finance due to debt review, defaults, missed payments, bad payment profiles, and low credit scores.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">Integrity First</div>
                  <div className="text-sm text-muted-foreground">Transparent process</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-semibold text-foreground">1000+ Clients</div>
                  <div className="text-sm text-muted-foreground">Successfully helped</div>
                </div>
              </div>
            </div>

            <Button variant="hero" size="lg" className="mt-8">
              Learn More About Our Process
            </Button>
          </div>
        </div>

        {/* Vision & Mission */}
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-primary text-primary-foreground shadow-elegant border-0">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <Target className="w-8 h-8 text-secondary" />
                <h3 className="text-2xl font-bold">Our Vision</h3>
              </div>
              <p className="text-primary-foreground/90 leading-relaxed">
                To be South Africa's leading Blacklist Solution Provider through our continuous support and guidance. 
                Our commitment to integrity and personalized solutions ensures optimal outcomes and peace of mind. 
                We create brighter financial futures by removing defaults, judgments, and bad payment profiles.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-secondary text-secondary-foreground shadow-elegant border-0">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <Heart className="w-8 h-8 text-white" />
                <h3 className="text-2xl font-bold">Our Mission</h3>
              </div>
              <p className="text-secondary-foreground/90 leading-relaxed">
                To provide complex and convenient solutions to our clients so they can live knowing that their hope has been restored. 
                We are dedicated to integrity and transparency, ensuring the effective removal of defaults, judgments, 
                and bad payment profiles through personalized debt review and credit profile management.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default About;