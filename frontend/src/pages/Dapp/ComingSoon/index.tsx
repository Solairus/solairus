import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
            <div className="relative">
              <Clock className="h-8 w-8 text-primary" />
              <Sparkles className="h-4 w-4 text-primary/60 absolute -top-1 -right-1 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl gradient-text">Coming Soon</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Exciting new features in development
          </p>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-3">
            <p className="text-muted-foreground">
              This feature is currently under development and will be available soon.
            </p>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                🚀 <strong>What's coming:</strong>
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• Advanced staking mechanisms</li>
                <li>• Enhanced reward systems</li>
                <li>• Community governance features</li>
              </ul>
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Stay tuned for updates!
            </p>
            <Button 
              onClick={() => navigate('/dapp')}
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}