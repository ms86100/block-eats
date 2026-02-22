import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { Shield, Search, CheckCircle, XCircle, User, Phone, Car, Clock, Users, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkerGateValidation } from '@/components/workforce/WorkerGateValidation';
import { ExpectedVisitorsList } from '@/components/guard/ExpectedVisitorsList';

interface VerifiedVisitor {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visitor_type: string;
  vehicle_number: string | null;
  flat_number: string | null;
  expected_time: string | null;
  status: string;
  resident_name?: string;
}

export default function GuardKioskPage() {
  const { effectiveSocietyId, isSocietyAdmin, isAdmin } = useAuth();
  const [isSecurityOfficer, setIsSecurityOfficer] = useState(false);

  useEffect(() => {
    const checkSecurityAccess = async () => {
      if (!effectiveSocietyId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('is_security_officer', {
        _user_id: user.id,
        _society_id: effectiveSocietyId,
      });
      setIsSecurityOfficer(!!data);
    };
    checkSecurityAccess();
  }, [effectiveSocietyId]);

  const [otpInput, setOtpInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAllowing, setIsAllowing] = useState(false);
  const [verifiedVisitor, setVerifiedVisitor] = useState<VerifiedVisitor | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const handleVerifyOTP = async () => {
    if (!otpInput.trim() || otpInput.length !== 6 || !effectiveSocietyId) return;
    setIsVerifying(true);
    setVerifiedVisitor(null);
    setVerificationStatus('idle');

    const { data, error } = await supabase
      .from('visitor_entries')
      .select('*, resident:profiles!visitor_entries_resident_id_fkey(name)')
      .eq('society_id', effectiveSocietyId)
      .eq('otp_code', otpInput.trim())
      .eq('status', 'expected')
      .maybeSingle();

    if (error || !data) {
      setVerificationStatus('failed');
      toast.error('Invalid or expired OTP');
    } else {
      setVerifiedVisitor({
        id: data.id,
        visitor_name: data.visitor_name,
        visitor_phone: data.visitor_phone,
        visitor_type: data.visitor_type,
        vehicle_number: data.vehicle_number,
        flat_number: data.flat_number,
        expected_time: data.expected_time,
        status: data.status,
        resident_name: (data as any).resident?.name,
      });
      setVerificationStatus('success');
    }
    setIsVerifying(false);
  };

  const handleAllowEntry = async () => {
    if (!verifiedVisitor) return;
    setIsAllowing(true);
    const { error } = await supabase.from('visitor_entries')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
      .eq('id', verifiedVisitor.id);

    if (!error) {
      toast.success(`${verifiedVisitor.visitor_name} checked in`);
      setVerifiedVisitor(null);
      setOtpInput('');
      setVerificationStatus('idle');
    }
    setIsAllowing(false);
  };

  const handleDeny = () => {
    setVerifiedVisitor(null);
    setOtpInput('');
    setVerificationStatus('idle');
    toast.info('Entry denied');
  };

  if (!isSocietyAdmin && !isAdmin && !isSecurityOfficer) {
    return (
      <AppLayout headerTitle="Guard Kiosk" showLocation={false}>
        <div className="p-4 text-center py-20 text-muted-foreground">
          <Shield size={48} className="mx-auto mb-4 opacity-50" />
          <p className="font-medium">Access Restricted</p>
          <p className="text-sm">Only society admins and security officers can access the guard kiosk.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Guard Kiosk" showLocation={false}>
      <div className="p-4 space-y-4">
        <Tabs defaultValue="visitor">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="visitor">OTP</TabsTrigger>
            <TabsTrigger value="expected">Expected</TabsTrigger>
            <TabsTrigger value="worker"><Users size={14} className="mr-1" /> Worker</TabsTrigger>
          </TabsList>

          <TabsContent value="visitor" className="mt-4 space-y-6">
            <Card className="border-2 border-primary/30">
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <Shield className="mx-auto text-primary mb-2" size={40} />
                  <h2 className="text-xl font-bold">Verify Visitor OTP</h2>
                  <p className="text-sm text-muted-foreground">Enter the 6-digit OTP shared by the resident</p>
                </div>

                <Input
                  value={otpInput}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpInput(val);
                    if (val.length < 6) setVerificationStatus('idle');
                  }}
                  placeholder="Enter 6-digit OTP"
                  className="text-center text-3xl font-mono tracking-[0.5em] h-16"
                  maxLength={6}
                  inputMode="numeric"
                />

                <Button
                  onClick={handleVerifyOTP}
                  disabled={otpInput.length !== 6 || isVerifying}
                  className="w-full h-14 text-lg"
                  size="lg"
                >
                  {isVerifying ? <Loader2 size={20} className="mr-2 animate-spin" /> : <Search size={20} className="mr-2" />}
                  {isVerifying ? 'Verifying...' : 'Verify OTP'}
                </Button>
              </CardContent>
            </Card>

            {verificationStatus === 'failed' && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-6 text-center">
                  <XCircle className="mx-auto text-destructive mb-3" size={48} />
                  <p className="text-lg font-bold text-destructive">Invalid OTP</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No matching visitor found. Check the OTP and try again.
                  </p>
                </CardContent>
              </Card>
            )}

            {verificationStatus === 'success' && verifiedVisitor && (
              <Card className="border-success/50 bg-success/5">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <CheckCircle className="mx-auto text-success mb-2" size={48} />
                    <p className="text-lg font-bold text-success">OTP Verified</p>
                  </div>

                  <div className="space-y-3 bg-background rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <User size={18} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Visitor</p>
                        <p className="font-bold text-lg">{verifiedVisitor.visitor_name}</p>
                      </div>
                    </div>

                    {verifiedVisitor.visitor_phone && (
                      <div className="flex items-center gap-3">
                        <Phone size={18} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-medium">{verifiedVisitor.visitor_phone}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Visiting</p>
                        <p className="font-medium">
                          {verifiedVisitor.resident_name || 'Unknown'} 
                          {verifiedVisitor.flat_number && ` • Flat ${verifiedVisitor.flat_number}`}
                        </p>
                      </div>
                    </div>

                    {verifiedVisitor.vehicle_number && (
                      <div className="flex items-center gap-3">
                        <Car size={18} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Vehicle</p>
                          <p className="font-medium font-mono">{verifiedVisitor.vehicle_number}</p>
                        </div>
                      </div>
                    )}

                    {verifiedVisitor.expected_time && (
                      <div className="flex items-center gap-3">
                        <Clock size={18} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Expected</p>
                          <p className="font-medium">{verifiedVisitor.expected_time}</p>
                        </div>
                      </div>
                    )}

                    <Badge variant="outline" className="capitalize">{verifiedVisitor.visitor_type.replace('_', ' ')}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ConfirmAction
                      title="Deny Entry?"
                      description={`Are you sure you want to deny entry to ${verifiedVisitor.visitor_name}? This action cannot be undone.`}
                      actionLabel="Deny Entry"
                      onConfirm={handleDeny}
                    >
                      <Button variant="destructive" size="lg" className="h-14 text-lg w-full">
                        <XCircle size={20} className="mr-2" /> Deny
                      </Button>
                    </ConfirmAction>
                    <Button variant="default" size="lg" className="h-14 text-lg" onClick={handleAllowEntry} disabled={isAllowing}>
                      {isAllowing ? <Loader2 size={20} className="mr-2 animate-spin" /> : <CheckCircle size={20} className="mr-2" />} Allow
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expected" className="mt-4">
            {effectiveSocietyId && <ExpectedVisitorsList societyId={effectiveSocietyId} />}
          </TabsContent>

          <TabsContent value="worker" className="mt-4">
            <WorkerGateValidation />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
