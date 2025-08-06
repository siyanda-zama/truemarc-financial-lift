import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  AlertTriangle, 
  UserCheck, 
  FileText, 
  Shield, 
  Search,
  Scale,
  Users,
  MessageSquare,
  ArrowRight
} from "lucide-react";

const Services = () => {
  const services = [
    {
      icon: CreditCard,
      title: "Bad Payment Profile",
      description: "We specialize in rectifying negative payment histories, ensuring your credit reflects accurate and positive financial behaviors. Our expert services pave the way for future opportunities and financial well-being.",
      features: ["Credit history analysis", "Payment profile optimization", "Future opportunity unlocking"]
    },
    {
      icon: AlertTriangle,
      title: "Default | Judgement",
      description: "Specializing in resolving defaults and judgments, we clear your credit record for improved financial prospects and stability. Trust us to navigate complexities with expert credit solutions.",
      features: ["Default removal", "Judgment clearance", "Credit record restoration"]
    },
    {
      icon: UserCheck,
      title: "Credit Profile Management",
      description: "Tailored solutions optimize your credit profile, enhancing financial standing and opening doors to favorable lending opportunities with personalized strategies.",
      features: ["Profile optimization", "Lending opportunities", "Personalized strategies"]
    },
    {
      icon: FileText,
      title: "Debt Review",
      description: "Our debt review services effectively manage and reduce debt, offering financial relief and guiding you towards a debt-free future confidently.",
      features: ["Debt management", "Financial relief", "Debt-free guidance"]
    },
    {
      icon: Shield,
      title: "Fraud Listing",
      description: "Specializing in fraudulent listing removal, we restore credit integrity, safeguard financial reputation, and open doors to future opportunities with confidence.",
      features: ["Fraud removal", "Credit integrity", "Reputation protection"]
    },
    {
      icon: Search,
      title: "Trace Alert",
      description: "Our proficient team efficiently handles trace alerts, ensuring accurate and reliable information on your credit report, vital for financial credibility.",
      features: ["Alert management", "Report accuracy", "Information reliability"]
    },
    {
      icon: FileText,
      title: "Admin Order",
      description: "Our admin order service streamlines financial management, ensuring efficient handling of administrative tasks for improved organization and smoother processes.",
      features: ["Financial streamlining", "Administrative efficiency", "Process optimization"]
    },
    {
      icon: Scale,
      title: "Labor Relations Consultants",
      description: "Expert guidance in navigating complex labor issues, fostering harmonious workplace environments while ensuring compliance with labor laws and regulations.",
      features: ["Labor law compliance", "Workplace harmony", "Strategic solutions"]
    },
    {
      icon: MessageSquare,
      title: "Paralegal (Blacklisting)",
      description: "Expert assistance in navigating legal issues related to blacklisting, offering support in addressing and resolving issues to safeguard your rights and reputation.",
      features: ["Legal navigation", "Rights protection", "Fair resolution"]
    }
  ];

  return (
    <section id="services" className="py-20 bg-background animate-fade-in">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Our <span className="text-primary">Comprehensive Services</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Comprehensive solutions for financial freedom. From credit repair to debt management, 
            we offer tailored services to guide you towards stability and success.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {services.map((service, index) => {
            const IconComponent = service.icon;
            return (
              <Card 
                key={index} 
                className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 border-border/50 hover:border-primary/30"
              >
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-gradient-hero rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {service.description}
                  </p>
                  <ul className="space-y-2 mb-6">
                    {service.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Services */}
        <Card className="bg-gradient-subtle border-primary/20 shadow-elegant">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <Users className="w-8 h-8 text-primary" />
              <h3 className="text-2xl font-bold text-foreground">General Consultants</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Our General Consultants offer comprehensive advisory services across diverse industries, 
              providing strategic insights, problem-solving expertise, and innovative solutions. We aim to drive 
              organizational success and sustainable growth by leveraging our expertise to address challenges 
              effectively and capitalize on opportunities for long-term prosperity and competitiveness.
            </p>
            <Button variant="professional" className="group">
              Learn More About General Consulting
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Ready to Transform Your Financial Future?
          </h3>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Contact Truemarc Consultants today for expert credit repair solutions tailored to your specific needs. 
            Let's embark on this journey together towards financial empowerment.
          </p>
          <a href="/contact">
            <Button variant="cta" size="lg" className="group">
              Get Your Free Consultation Today
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Services;