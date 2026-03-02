import { useState, useContext } from 'react';
import { IdentityContext } from '@/contexts/auth/contexts';
import { runPushDiagnostics, printDiagnostics, DiagnosticResult } from '@/lib/pushDiagnostics';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { flushPushLogs } from '@/lib/pushLogger';

interface LogRow {
  id: string;
  level: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function PushDebugPage() {
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await runPushDiagnostics(user?.id);
      printDiagnostics(r);
      setResults(r);
    } catch (e) {
      toast.error('Diagnostics failed: ' + String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleLoadLogs = async () => {
    if (!user) return;
    setLoadingLogs(true);
    // Flush any buffered logs first
    await flushPushLogs();
    try {
      const { data, error } = await supabase
        .from('push_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs((data as LogRow[]) ?? []);
    } catch (e) {
      toast.error('Failed to load logs: ' + String(e));
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('push_logs')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      setLogs([]);
      toast.success('Logs cleared');
    } catch (e) {
      toast.error('Failed to clear: ' + String(e));
    }
  };

  const levelColor = (level: string) => {
    if (level === 'error') return 'destructive';
    if (level === 'warn') return 'outline';
    return 'secondary';
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">🔔 Push Notification Debug</h1>
      <p className="text-sm text-muted-foreground">
        User: {user?.id?.substring(0, 8) ?? 'not logged in'}…
      </p>

      {/* Diagnostics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleRun} disabled={running} className="w-full">
            {running ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw className="mr-2" size={16} />}
            Run Diagnostics
          </Button>

          {results && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {r.ok ? (
                    <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className="font-medium">{r.step}</span>
                    <p className="text-muted-foreground text-xs break-all">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remote Logs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Remote Logs</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClearLogs}>
                <Trash2 size={14} className="mr-1" /> Clear
              </Button>
              <Button variant="outline" size="sm" onClick={handleLoadLogs} disabled={loadingLogs}>
                {loadingLogs ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No logs yet. Logs will appear here after the app runs push registration on your device.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={levelColor(log.level) as any} className="text-[10px]">
                        {log.level}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-mono break-all">{log.message}</p>
                    {log.metadata && (
                      <pre className="text-[10px] text-muted-foreground bg-muted p-1 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
