import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <AppLayout headerTitle="Terms & Conditions" showLocation={false}>
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Terms & Conditions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated: January 30, 2026
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
              <p className="text-muted-foreground">
                By downloading, installing, or using BlockEats ("the App"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the App.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Eligibility</h3>
              <p className="text-muted-foreground">
                This App is exclusively for verified residents of Shriram Greenfield community. By using the App, you confirm that:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
                <li>You are a current resident of Shriram Greenfield</li>
                <li>You are at least 18 years of age</li>
                <li>The information you provide during registration is accurate</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. Account Registration</h3>
              <p className="text-muted-foreground">
                Users must provide accurate information including name, phone number, block, and flat number. Accounts are subject to verification by community administrators. False information may result in account suspension.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">4. Services Description</h3>
              <p className="text-muted-foreground">
                BlockEats is a community marketplace platform that connects home-based food sellers with buyers within Shriram Greenfield. We facilitate transactions but are not a party to the sale of food items. Sellers are independent individuals responsible for their products.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">5. Buyer Responsibilities</h3>
              <p className="text-muted-foreground mb-2">As a buyer, you agree to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Provide accurate delivery information</li>
                <li>Be available to receive orders at the specified time</li>
                <li>Make timely payments for orders</li>
                <li>Communicate respectfully with sellers</li>
                <li>Report any issues through proper channels</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">6. Seller Responsibilities</h3>
              <p className="text-muted-foreground mb-2">As a seller, you agree to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Maintain food safety and hygiene standards</li>
                <li>Provide accurate product descriptions and pricing</li>
                <li>Honor accepted orders and deliver on time</li>
                <li>Handle customer complaints professionally</li>
                <li>Comply with all applicable food safety regulations</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">7. Payments</h3>
              <p className="text-muted-foreground">
                The App supports Cash on Delivery (COD) and UPI payments. All transactions are between buyers and sellers directly. BlockEats does not process or store payment card information. Disputes regarding payments should be resolved between the parties involved.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">8. Order Cancellation</h3>
              <p className="text-muted-foreground">
                Orders may be cancelled before the seller starts preparing. Once preparation begins, cancellation may not be possible. Sellers have the right to cancel orders if unable to fulfill them, with notification to the buyer.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">9. Reviews and Ratings</h3>
              <p className="text-muted-foreground">
                Users may leave reviews and ratings after completed orders. Reviews must be honest, respectful, and relevant to the transaction. Inappropriate reviews may be removed by administrators.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">10. Prohibited Conduct</h3>
              <p className="text-muted-foreground mb-2">Users must not:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Provide false information or impersonate others</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Sell prohibited items (alcohol, tobacco, etc.)</li>
                <li>Engage in fraudulent transactions</li>
                <li>Violate community guidelines or local laws</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">11. Limitation of Liability</h3>
              <p className="text-muted-foreground">
                BlockEats is a platform connecting community members. We are not liable for the quality, safety, or legality of items sold, the accuracy of listings, the ability of sellers to deliver, or any disputes between users. Use of the App is at your own risk.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">12. Account Termination</h3>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate accounts that violate these terms or community guidelines. Users may also request account deletion at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">13. Changes to Terms</h3>
              <p className="text-muted-foreground">
                We may modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">14. Governing Law</h3>
              <p className="text-muted-foreground">
                These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Bangalore, Karnataka.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">15. Contact</h3>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact the community administrator through the app's Help & Support section.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
