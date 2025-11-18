import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { z } from "zod";

const mqttPayloadSchema = z.object({
  device_id: z.string().min(1, "Device ID is required").max(50),
  moth_count: z.number().min(0).max(10000),
  temperature_c: z.number().min(-50).max(100),
  computed_degree_days: z.number().min(0).max(10000),
  computed_status: z.enum(["green", "yellow", "yellow_medium_risk", "red"]),
});

type MQTTPayload = z.infer<typeof mqttPayloadSchema>;

export default function DeviceTest() {
  const [formData, setFormData] = useState<MQTTPayload>({
    device_id: "ESP_TEST_001",
    moth_count: 15,
    temperature_c: 28,
    computed_degree_days: 150,
    computed_status: "yellow",
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    response?: any;
  } | null>(null);

  const handleInputChange = (field: keyof MQTTPayload, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTest = async () => {
    try {
      setIsLoading(true);
      setTestResult(null);

      // Validate form data
      const validatedData = mqttPayloadSchema.parse(formData);
      
      console.log("Testing MQTT payload:", validatedData);

      // Call the mqtt-bridge edge function
      const { data, error } = await supabase.functions.invoke('mqtt-bridge', {
        body: validatedData,
      });

      if (error) {
        console.error("MQTT Bridge Error:", error);
        setTestResult({
          success: false,
          message: error.message || "Failed to process MQTT message",
        });
        toast.error("Test failed: " + error.message);
      } else {
        console.log("MQTT Bridge Response:", data);
        setTestResult({
          success: true,
          message: "MQTT message processed successfully!",
          response: data,
        });
        toast.success("Test successful! Data pipeline working.");
      }
    } catch (error) {
      console.error("Test error:", error);
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        setTestResult({
          success: false,
          message: `Validation error: ${firstError.message}`,
        });
        toast.error(`Validation error: ${firstError.message}`);
      } else {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
        toast.error("Test failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Device Testing</h1>
        <p className="text-muted-foreground">
          Simulate MQTT messages from ESP devices to test the complete data pipeline
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MQTT Message Simulator</CardTitle>
          <CardDescription>
            Enter device data to simulate an MQTT message from an ESP device. This will test the
            complete flow: MQTT Bridge → Ingest Data → Database Update.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device_id">Device ID</Label>
              <Input
                id="device_id"
                value={formData.device_id}
                onChange={(e) => handleInputChange("device_id", e.target.value)}
                placeholder="ESP_TEST_001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moth_count">Moth Count</Label>
              <Input
                id="moth_count"
                type="number"
                value={formData.moth_count}
                onChange={(e) => handleInputChange("moth_count", parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature_c">Temperature (°C)</Label>
              <Input
                id="temperature_c"
                type="number"
                step="0.1"
                value={formData.temperature_c}
                onChange={(e) => handleInputChange("temperature_c", parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="degree_days">Degree Days</Label>
              <Input
                id="degree_days"
                type="number"
                step="0.1"
                value={formData.computed_degree_days}
                onChange={(e) => handleInputChange("computed_degree_days", parseFloat(e.target.value) || 0)}
                min="0"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="computed_status">Computed Status (Pre-computed by ESP)</Label>
              <Select
                value={formData.computed_status}
                onValueChange={(value) => handleInputChange("computed_status", value)}
              >
                <SelectTrigger id="computed_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green (Safe)</SelectItem>
                  <SelectItem value="yellow">Yellow (Low Risk)</SelectItem>
                  <SelectItem value="yellow_medium_risk">Yellow Medium Risk</SelectItem>
                  <SelectItem value="red">Red (High Risk)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleTest}
              disabled={isLoading}
              className="flex-1 sm:flex-initial"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Pipeline...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Message
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <AlertDescription className="font-medium">
                    {testResult.message}
                  </AlertDescription>
                  {testResult.response && (
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                      {JSON.stringify(testResult.response, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </Alert>
          )}

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Expected Payload Format:</h3>
            <pre className="text-xs overflow-auto">
{`{
  "device_id": "ESP_TEST_001",
  "moth_count": 15,
  "temperature_c": 28,
  "computed_degree_days": 150,
  "computed_status": "yellow_medium_risk"
}`}
            </pre>
            <p className="text-xs text-muted-foreground mt-2">
              This simulates what an ESP device sends via MQTT to freemqtt.com (topic: LADYBUG/farm_data)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
