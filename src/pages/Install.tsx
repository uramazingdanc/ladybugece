import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check, Share, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">App Installed!</CardTitle>
            <CardDescription>
              LADYBUG has been successfully installed on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/')} className="w-full h-12" size="lg">
              Open Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-20 w-20 bg-white rounded-2xl shadow-lg flex items-center justify-center">
            <img src="/icon-192x192.png" alt="LADYBUG" className="h-16 w-16 rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Install LADYBUG</h1>
          <p className="text-muted-foreground">
            Get the app for quick access to farm monitoring
          </p>
        </div>

        <div className="space-y-6">
          {/* Android/Desktop Install */}
          {deferredPrompt && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Quick Install
                </CardTitle>
                <CardDescription>
                  Install LADYBUG with one click
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleInstallClick} className="w-full h-12" size="lg">
                  <Download className="h-5 w-5 mr-2" />
                  Install App
                </Button>
              </CardContent>
            </Card>
          )}

          {/* iOS Instructions */}
          {isIOS && !deferredPrompt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Install on iPhone/iPad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Tap the Share button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Share className="h-4 w-4" />
                        Look for the share icon in Safari
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Select "Add to Home Screen"</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Scroll down in the share menu
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Confirm to add LADYBUG to your home screen
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Android Manual Instructions */}
          {isAndroid && !deferredPrompt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Install on Android
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Tap the menu button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Menu className="h-4 w-4" />
                        Three dots in Chrome browser
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Select "Install app" or "Add to Home screen"</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Look for the install option
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Confirm installation</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        LADYBUG will appear on your home screen
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Why Install?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Quick Access</p>
                  <p className="text-sm text-muted-foreground">
                    Launch directly from your home screen
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Works Offline</p>
                  <p className="text-sm text-muted-foreground">
                    Access cached data without internet
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Fast Performance</p>
                  <p className="text-sm text-muted-foreground">
                    Native app-like speed and experience
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Always Updated</p>
                  <p className="text-sm text-muted-foreground">
                    Automatic updates when you launch
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full h-12"
            size="lg"
          >
            Continue in Browser
          </Button>
        </div>
      </div>
    </div>
  );
}
