import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface AlertStatusCardProps {
  alertData: {
    alert_level: 'Green' | 'Yellow' | 'Red';
    last_moth_count: number;
    last_updated: string;
  };
}

export default function AlertStatusCard({ alertData }: AlertStatusCardProps) {
  const getAlertConfig = () => {
    switch (alertData.alert_level) {
      case 'Red':
        return {
          icon: AlertCircle,
          title: 'CRITICAL ALERT',
          message: 'Immediate action required! High moth population detected.',
          bgClass: 'bg-alert-red-light border-alert-red',
          textClass: 'text-alert-red',
          iconClass: 'text-alert-red'
        };
      case 'Yellow':
        return {
          icon: AlertTriangle,
          title: 'WARNING',
          message: 'Monitor closely. Moth population is increasing.',
          bgClass: 'bg-alert-yellow-light border-alert-yellow',
          textClass: 'text-alert-yellow',
          iconClass: 'text-alert-yellow'
        };
      default:
        return {
          icon: CheckCircle,
          title: 'ALL CLEAR',
          message: 'Moth population is under control.',
          bgClass: 'bg-alert-green-light border-alert-green',
          textClass: 'text-alert-green',
          iconClass: 'text-alert-green'
        };
    }
  };

  const config = getAlertConfig();
  const Icon = config.icon;

  return (
    <Card className={`${config.bgClass} border-2`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <Icon className={`w-8 h-8 ${config.iconClass}`} />
          <div>
            <div className={`text-2xl font-bold ${config.textClass}`}>{config.title}</div>
            <div className="text-sm text-muted-foreground font-normal mt-1">
              Last updated: {new Date(alertData.last_updated).toLocaleString()}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg">{config.message}</p>
      </CardContent>
    </Card>
  );
}
