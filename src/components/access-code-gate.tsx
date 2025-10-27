import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccessCodeGateProps {
  children: React.ReactNode;
}

const ACCESS_CODE_KEY = "access_code_verified";

export function AccessCodeGate({ children }: AccessCodeGateProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const verified = localStorage.getItem(ACCESS_CODE_KEY);
    if (verified === "true") {
      setIsVerified(true);
    }
    setIsChecking(false);
  }, []);

  const handleVerify = async () => {
    if (!code.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رمز الدخول",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/verify-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (response.ok) {
        localStorage.setItem(ACCESS_CODE_KEY, "true");
        setIsVerified(true);
        toast({
          title: "نجح التحقق!",
          description: "مرحباً بك في النظام",
        });
      } else {
        toast({
          title: "رمز خاطئ",
          description: "الرمز الذي أدخلته غير صحيح. حاول مرة أخرى.",
          variant: "destructive",
        });
        setCode("");
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التحقق. حاول مرة أخرى.",
        variant: "destructive",
      });
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">رمز الدخول مطلوب</CardTitle>
            <CardDescription>
              الرجاء إدخال رمز الدخول للوصول إلى النظام
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                data-testid="input-access-code"
                type="text"
                placeholder="أدخل رمز الدخول"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleVerify();
                  }
                }}
                className="text-center text-lg tracking-wider"
              />
            </div>
            <Button
              data-testid="button-verify-code"
              onClick={handleVerify}
              className="w-full"
              size="lg"
            >
              تحقق من الرمز
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
