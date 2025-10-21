import { useState } from "react";
import { Upload, AlertCircle, CheckCircle2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

type Step = "upload" | "review" | "processing" | "success";

interface ExtractedData {
  planCode: string;
  planTitle: string;
  building: string;
  floor: string;
  discipline: string;
  thumbnail?: string;
}

export function IngestPlansModal() {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    planCode: "A-101",
    planTitle: "Ground Floor Plan",
    building: "Main Tower",
    floor: "Ground Floor",
    discipline: "Architectural",
  });
  const [isMultiPage, setIsMultiPage] = useState(false);
  const [hasConflict, setHasConflict] = useState(true);
  const [conflictResolution, setConflictResolution] = useState<"version" | "new">("version");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setCurrentStep("review");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleProcess = () => {
    setCurrentStep("processing");
    setTimeout(() => {
      setCurrentStep("success");
    }, 3000);
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setSelectedFile(null);
    setHasConflict(false);
  };

  const steps = [
    { id: "upload", label: "رفع الملفات", icon: Upload, active: currentStep === "upload" },
    { id: "review", label: "المراجعة والتوصيل", icon: FileText, active: currentStep === "review" },
    { id: "processing", label: "المعالجة", icon: AlertCircle, active: currentStep === "processing" || currentStep === "success" },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-xl bg-card shadow-2xl flex flex-col border">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-modal-title">
            استيراد وإنشاء مخططات جديدة
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-modal-description">
            اتبع الخطوات لرفع ومعالجة مخططات البناء الخاصة بك
          </p>
        </div>

        {/* Main Content */}
        <div className="flex flex-grow">
          {/* Stepper Sidebar */}
          <div className="w-1/4 p-6 border-l">
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={step.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center size-10 rounded-full transition-colors ${
                        step.active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`step-indicator-${step.id}`}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-0.5 h-12 mt-2 ${
                          step.active ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <p
                      className={`text-base font-medium ${
                        step.active ? "text-primary" : "text-foreground"
                      }`}
                      data-testid={`text-step-${step.id}`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="w-3/4 p-6 space-y-6 border-l">
            {/* Step 1: Upload */}
            {currentStep === "upload" && (
              <div className="space-y-4">
                <div
                  className={`flex flex-col items-center gap-6 rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone-upload"
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Upload className="h-12 w-12 text-primary" />
                    <div>
                      <p className="text-lg font-bold text-foreground" data-testid="text-dropzone-title">
                        اسحب وأفلت الملفات هنا
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        الصيغ المدعومة: PDF, IFC, JPG, PNG
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pdf,.ifc,.jpg,.jpeg,.png";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFileSelect(file);
                      };
                      input.click();
                    }}
                    data-testid="button-browse-files"
                  >
                    تصفح الملفات
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Review & Map */}
            {currentStep === "review" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground" data-testid="text-review-title">
                    مراجعة وتوصيل بيانات المخطط
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    قمنا باستخراج البيانات التالية تلقائياً. يرجى المراجعة والتأكيد.
                  </p>
                </div>

                {/* File Preview */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="flex-grow space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-foreground" data-testid="text-filename">
                          {selectedFile?.name || "A-101-Architecture-GroundFloor.pdf"}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleReset}
                          data-testid="button-remove-file"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="plan-code">رمز المخطط</Label>
                          <Input
                            id="plan-code"
                            value={extractedData.planCode}
                            onChange={(e) =>
                              setExtractedData({ ...extractedData, planCode: e.target.value })
                            }
                            data-testid="input-plan-code"
                          />
                        </div>
                        <div>
                          <Label htmlFor="plan-title">عنوان المخطط</Label>
                          <Input
                            id="plan-title"
                            value={extractedData.planTitle}
                            onChange={(e) =>
                              setExtractedData({ ...extractedData, planTitle: e.target.value })
                            }
                            data-testid="input-plan-title"
                          />
                        </div>
                        <div>
                          <Label htmlFor="building">
                            المبنى <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={extractedData.building}
                            onValueChange={(value) =>
                              setExtractedData({ ...extractedData, building: value })
                            }
                          >
                            <SelectTrigger id="building" data-testid="select-building">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Main Tower">البرج الرئيسي</SelectItem>
                              <SelectItem value="Annex Building">المبنى الملحق</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="floor">
                            الطابق <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={extractedData.floor}
                            onValueChange={(value) =>
                              setExtractedData({ ...extractedData, floor: value })
                            }
                          >
                            <SelectTrigger id="floor" data-testid="select-floor">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ground Floor">الطابق الأرضي</SelectItem>
                              <SelectItem value="Level 1">المستوى 1</SelectItem>
                              <SelectItem value="Level 2">المستوى 2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="discipline">
                            التخصص <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={extractedData.discipline}
                            onValueChange={(value) =>
                              setExtractedData({ ...extractedData, discipline: value })
                            }
                          >
                            <SelectTrigger id="discipline" data-testid="select-discipline">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Architectural">معماري</SelectItem>
                              <SelectItem value="Structural">إنشائي</SelectItem>
                              <SelectItem value="MEP">كهروميكانيك</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-page PDF Toggle */}
                  <div className="flex items-center justify-between gap-4 bg-primary/10 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex flex-col">
                        <p className="text-primary text-sm font-medium">
                          PDF متعدد الصفحات مكتشف
                        </p>
                        <p className="text-primary/80 text-xs">
                          هل تريد تقسيمه إلى مخطط لكل صفحة؟
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isMultiPage}
                      onCheckedChange={setIsMultiPage}
                      data-testid="switch-multipage"
                    />
                  </div>

                  {/* Conflict Resolution */}
                  {hasConflict && (
                    <div className="flex items-start gap-4 bg-warning/10 p-4 rounded-lg border border-warning/20">
                      <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div className="flex-grow space-y-3">
                        <p className="font-semibold text-warning-foreground">
                          يوجد مخطط بهذا الرمز مسبقاً
                        </p>
                        <p className="text-sm text-warning-foreground/80">
                          كيف تريد المتابعة؟
                        </p>
                        <RadioGroup
                          value={conflictResolution}
                          onValueChange={(value) =>
                            setConflictResolution(value as "version" | "new")
                          }
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem
                              value="version"
                              id="new-version"
                              data-testid="radio-new-version"
                            />
                            <Label htmlFor="new-version" className="cursor-pointer">
                              إنشاء نسخة جديدة من المخطط الموجود
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem
                              value="new"
                              id="new-plan"
                              data-testid="radio-new-plan"
                            />
                            <Label htmlFor="new-plan" className="cursor-pointer">
                              إنشاء مخطط جديد منفصل (يتطلب تغيير الرمز)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Processing */}
            {currentStep === "processing" && (
              <div className="p-8 rounded-lg border border-dashed bg-muted/30 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-foreground font-medium" data-testid="text-processing">
                    جاري معالجة الملفات...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    قد يستغرق هذا بضع لحظات. يرجى عدم إغلاق هذه النافذة.
                  </p>
                </div>
                <Progress value={66} className="w-full max-w-xs" />
              </div>
            )}

            {/* Step 4: Success */}
            {currentStep === "success" && (
              <div className="p-8 rounded-lg bg-success/10 border border-success/20 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
                <CheckCircle2 className="h-16 w-16 text-success" />
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground" data-testid="text-success-title">
                    المخططات جاهزة!
                  </h2>
                  <p className="text-foreground/80">
                    تم بنجاح! المخططات الجديدة تم إنشاؤها وهي متاحة الآن.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 p-6 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            data-testid="button-cancel"
          >
            إلغاء
          </Button>
          {currentStep === "review" && (
            <Button
              onClick={handleProcess}
              data-testid="button-confirm-process"
            >
              تأكيد ومعالجة
            </Button>
          )}
          {currentStep === "success" && (
            <Button
              onClick={handleReset}
              data-testid="button-add-more"
            >
              إضافة المزيد
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
