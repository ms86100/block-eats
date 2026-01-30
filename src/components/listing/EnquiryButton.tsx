import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MessageCircle, Loader2, Phone } from 'lucide-react';

interface EnquiryButtonProps {
  sellerId: string;
  listingId: string;
  listingName: string;
  sellerName: string;
  sellerPhone?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function EnquiryButton({
  sellerId,
  listingId,
  listingName,
  sellerName,
  sellerPhone,
  variant = 'default',
  size = 'default',
  className,
}: EnquiryButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEnquire = async () => {
    if (!user) {
      toast.error('Please sign in to contact the seller');
      navigate('/auth');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsLoading(true);
    try {
      // Create an enquiry order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: sellerId,
          total_amount: 0,
          order_type: 'enquiry',
          status: 'enquired',
          notes: `Enquiry for: ${listingName}\n\n${message}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create initial chat message
      const { error: chatError } = await supabase
        .from('chat_messages')
        .insert({
          order_id: order.id,
          sender_id: user.id,
          receiver_id: sellerId,
          message_text: `Hi! I'm interested in "${listingName}".\n\n${message}`,
        });

      if (chatError) throw chatError;

      toast.success('Enquiry sent! The seller will contact you soon.');
      setIsOpen(false);
      setMessage('');
      navigate(`/orders/${order.id}`);
    } catch (error) {
      console.error('Error sending enquiry:', error);
      toast.error('Failed to send enquiry');
    } finally {
      setIsLoading(false);
    }
  };

  const defaultMessage = `Hi, I'm interested in "${listingName}". Is it still available?`;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          if (!message) setMessage(defaultMessage);
          setIsOpen(true);
        }}
      >
        <MessageCircle size={16} className="mr-2" />
        Contact Seller
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact {sellerName}</DialogTitle>
            <DialogDescription>
              Send a message about "{listingName}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Write your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />

            <div className="flex gap-2">
              {sellerPhone && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`tel:${sellerPhone}`, '_self')}
                >
                  <Phone size={16} className="mr-2" />
                  Call
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={handleEnquire}
                disabled={isLoading || !message.trim()}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mr-2" size={16} />
                ) : (
                  <MessageCircle size={16} className="mr-2" />
                )}
                Send Message
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Your contact details will be shared with the seller
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
