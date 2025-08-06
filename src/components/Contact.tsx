import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Send,
  MessageCircle,
  Calendar
} from "lucide-react";

const Contact = () => {
  return (
    <section id="contact" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Transform Your <span className="text-primary">Financial Future?</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Contact Truemarc Consultants today for expert credit repair solutions tailored to your needs. 
            Let's start your journey towards financial freedom.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-primary">
                  <MapPin className="w-6 h-6" />
                  Our Office
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Office No E1, 2nd Floor Office Park<br />
                  Chris Hani Street<br />
                  Bethal 2310<br />
                  South Africa
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-primary">
                  <Phone className="w-6 h-6" />
                  Phone Numbers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <a href="tel:0615449643" className="text-muted-foreground hover:text-primary transition-colors">
                    061 544 9643
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <a href="tel:0766339395" className="text-muted-foreground hover:text-primary transition-colors">
                    076 633 9395
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-primary">
                  <Mail className="w-6 h-6" />
                  Email & Website
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <a href="mailto:admin@truemarc.co.za" className="text-muted-foreground hover:text-primary transition-colors">
                    admin@truemarc.co.za
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <a href="https://www.truemarc-consultants.co.za" className="text-muted-foreground hover:text-primary transition-colors">
                    www.truemarc-consultants.co.za
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-primary">
                  <Clock className="w-6 h-6" />
                  Business Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Monday - Friday:</span>
                    <span>8:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday:</span>
                    <span>9:00 AM - 1:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday:</span>
                    <span>Closed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="shadow-elegant border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-foreground">
                  Get Your Free Consultation
                </CardTitle>
                <p className="text-muted-foreground">
                  Fill out the form below and our expert consultants will get back to you within 24 hours.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">First Name *</label>
                    <Input placeholder="Enter your first name" className="border-border focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Last Name *</label>
                    <Input placeholder="Enter your last name" className="border-border focus:border-primary" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email Address *</label>
                    <Input type="email" placeholder="Enter your email" className="border-border focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Phone Number *</label>
                    <Input type="tel" placeholder="Enter your phone number" className="border-border focus:border-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Service Needed</label>
                  <select className="w-full px-3 py-2 border border-border rounded-md focus:border-primary focus:outline-none bg-background">
                    <option value="">Select a service</option>
                    <option value="credit-repair">Credit Repair</option>
                    <option value="debt-review">Debt Review</option>
                    <option value="default-removal">Default Removal</option>
                    <option value="judgment-clearance">Judgment Clearance</option>
                    <option value="fraud-listing">Fraud Listing Removal</option>
                    <option value="general-consultation">General Consultation</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Message *</label>
                  <Textarea 
                    placeholder="Tell us about your financial situation and how we can help you..."
                    className="min-h-[120px] border-border focus:border-primary"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="cta" size="lg" className="flex-1 group">
                    <Send className="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
                    Send Message
                  </Button>
                  <Button variant="professional" size="lg" className="flex-1 group">
                    <Calendar className="w-5 h-5 mr-2" />
                    Schedule Call
                  </Button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <strong>Quick Response:</strong> We typically respond to all inquiries within 2-4 hours during business hours.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <Card className="bg-gradient-hero text-primary-foreground shadow-elegant border-0 max-w-4xl mx-auto">
            <CardContent className="p-8 md:p-12">
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Don't Let Poor Credit Hold You Back
              </h3>
              <p className="text-lg text-primary-foreground/90 mb-6 leading-relaxed">
                Take the first step towards financial freedom. Our expert team is ready to analyze your 
                credit situation and provide you with a personalized action plan.
              </p>
              <Button variant="cta" size="lg">
                Get Your Free Credit Analysis Today
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default Contact;