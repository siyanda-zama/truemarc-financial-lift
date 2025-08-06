import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  Shield, 
  Users, 
  Clock, 
  Star, 
  Award,
  TrendingUp,
  Heart
} from "lucide-react";
import consultantFemaleImage from "@/assets/consultant-female.jpg";

const WhyChooseUs = () => {
  const benefits = [
    {
      icon: Shield,
      title: "Unwavering Integrity",
      description: "We operate with complete transparency and honesty, ensuring you understand every step of the process."
    },
    {
      icon: Users,
      title: "9+ Years Experience",
      description: "Since 2015, we've successfully helped over 1000 clients restore their financial dignity."
    },
    {
      icon: Award,
      title: "Proven Track Record",
      description: "Our expertise in credit repair has enabled us to achieve outstanding results for our clients."
    },
    {
      icon: TrendingUp,
      title: "Personalized Solutions",
      description: "Every client receives tailored strategies designed specifically for their unique financial situation."
    },
    {
      icon: Clock,
      title: "Efficient Process",
      description: "We streamline the credit repair process to deliver results as quickly and effectively as possible."
    },
    {
      icon: Heart,
      title: "Client-Centric Service",
      description: "Your financial well-being is our priority, and we're with you every step of the way."
    }
  ];

  const stats = [
    { number: "1000+", label: "Clients Served", icon: Users },
    { number: "9+", label: "Years Experience", icon: Award },
    { number: "100%", label: "Commitment", icon: Heart },
    { number: "24/7", label: "Support", icon: Clock }
  ];

  return (
    <section id="why-choose-us" className="py-20 bg-gradient-subtle animate-fade-in">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Why Choose <span className="text-primary">Truemarc Consultants</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Your partner in revolutionary credit repair, committed to empowering financial freedom with 
            unwavering integrity and excellence.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          {/* Left: Benefits */}
          <div className="space-y-6">
            {benefits.map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <Card 
                  key={index}
                  className="group hover:shadow-card transition-all duration-300 border-border/50 hover:border-primary/30"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-hero rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                          {benefit.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Right: Image */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl shadow-elegant">
              <img 
                src={consultantFemaleImage}
                alt="Professional Financial Advisor"
                className="w-full h-[600px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent"></div>
            </div>
            
            {/* Floating Quote Card */}
            <Card className="absolute -bottom-8 -left-8 bg-white shadow-elegant border-0 max-w-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground italic mb-3">
                  "Trust us to navigate complexities, ensuring your credit reflects positively, 
                  paving the way for lasting stability and prosperity."
                </p>
                <div className="text-xs font-semibold text-primary">- Truemarc Promise</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index} className="text-center bg-white shadow-card border-0">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-gradient-accent rounded-xl flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">{stat.number}</div>
                  <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Commitment Statement */}
        <Card className="bg-primary text-primary-foreground shadow-elegant border-0">
          <CardContent className="p-8 md:p-12 text-center">
            <CheckCircle className="w-16 h-16 text-secondary mx-auto mb-6" />
            <h3 className="text-2xl md:text-3xl font-bold mb-6">
              Our Commitment to Your Success
            </h3>
            <p className="text-lg text-primary-foreground/90 leading-relaxed max-w-4xl mx-auto mb-8">
              Truemarc Consultants is your partner in revolutionary credit repair, committed to empowering 
              financial freedom. With unwavering integrity and excellence, we expertly remove defaults and 
              judgments, offering personalized services tailored for a brighter financial future. Trust us 
              to navigate complexities, ensuring your credit reflects positively, paving the way for lasting 
              stability and prosperity. Let's embark on this journey together towards financial empowerment 
              and a brighter tomorrow.
            </p>
            <a href="/contact">
              <Button variant="cta" size="lg">
                Start Your Financial Transformation Today
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default WhyChooseUs;