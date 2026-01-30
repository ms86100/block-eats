import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicyPage() {
  return (
    <AppLayout headerTitle="Privacy Policy" showLocation={false}>
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated: January 30, 2026
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Introduction</h3>
              <p className="text-muted-foreground">
                Welcome to BlockEats ("we", "our", or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application designed exclusively for Shriram Greenfield residents.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Information We Collect</h3>
              <p className="text-muted-foreground mb-2">We collect the following types of information:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>Personal Information:</strong> Name, phone number, email address, block number, and flat number for identity verification and delivery purposes.</li>
                <li><strong>Order Information:</strong> Details of orders placed, including items purchased, order history, and delivery preferences.</li>
                <li><strong>Payment Information:</strong> UPI IDs for payment processing (we do not store sensitive payment credentials).</li>
                <li><strong>Communication Data:</strong> Messages exchanged between buyers and sellers regarding orders.</li>
                <li><strong>Device Information:</strong> Device type, operating system, and app version for troubleshooting and improvement.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. How We Use Your Information</h3>
              <p className="text-muted-foreground mb-2">We use your information to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Verify your residence in Shriram Greenfield community</li>
                <li>Process and fulfill your orders</li>
                <li>Facilitate communication between buyers and sellers</li>
                <li>Send order updates and notifications</li>
                <li>Improve our app and services</li>
                <li>Ensure community safety and prevent fraud</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">4. Information Sharing</h3>
              <p className="text-muted-foreground">
                We share your information only with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>Sellers:</strong> Your name, block, and flat number for order delivery</li>
                <li><strong>Community Admins:</strong> For verification and dispute resolution</li>
                <li><strong>Service Providers:</strong> Third-party services that help us operate the app</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">5. Data Security</h3>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All data is encrypted in transit and at rest.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">6. Data Retention</h3>
              <p className="text-muted-foreground">
                We retain your personal information for as long as you maintain an active account. Order history is retained for 2 years for reference. You may request deletion of your account and associated data at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">7. Your Rights</h3>
              <p className="text-muted-foreground mb-2">You have the right to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of non-essential communications</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">8. Children's Privacy</h3>
              <p className="text-muted-foreground">
                Our app is not intended for users under 18 years of age. We do not knowingly collect information from children.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">9. Changes to This Policy</h3>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">10. Contact Us</h3>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy, please contact the community administrator through the app's Help & Support section.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
