import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, User, Briefcase, Home, DollarSign } from "lucide-react";

interface FormData {
  // Borrower
  borrowerName: string;
  borrowerAge: string;
  borrowerEmail: string;
  borrowerPhone: string;
  // Employment
  employerName: string;
  jobTitle: string;
  yearsEmployed: string;
  annualIncome: string;
  employmentType: string;
  // Loan
  loanAmount: string;
  loanTermMonths: string;
  loanPurpose: string;
  downPayment: string;
  creditScore: string;
  existingDebtsMonthly: string;
  // Property
  propertyAddress: string;
  propertyType: string;
  propertyValue: string;
  propertySquareFeet: string;
  propertyBedrooms: string;
  propertyBathrooms: string;
  propertyYearBuilt: string;
  propertyState: string;
  propertyZip: string;
}

const INITIAL: FormData = {
  borrowerName: "", borrowerAge: "", borrowerEmail: "", borrowerPhone: "",
  employerName: "", jobTitle: "", yearsEmployed: "", annualIncome: "", employmentType: "Full-time",
  loanAmount: "", loanTermMonths: "360", loanPurpose: "Purchase", downPayment: "", creditScore: "", existingDebtsMonthly: "",
  propertyAddress: "", propertyType: "Single Family", propertyValue: "", propertySquareFeet: "", propertyBedrooms: "", propertyBathrooms: "", propertyYearBuilt: "", propertyState: "", propertyZip: "",
};

const STEPS = [
  { id: 0, label: "Borrower", icon: User },
  { id: 1, label: "Employment", icon: Briefcase },
  { id: 2, label: "Loan", icon: DollarSign },
  { id: 3, label: "Property", icon: Home },
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block label-caps mb-1.5">
        {label}{required && <span className="text-primary ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:border-foreground transition-colors"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:border-foreground transition-colors appearance-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function Apply() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [, setLocation] = useLocation();

  const submit = trpc.mortgage.submitApplication.useMutation({
    onSuccess: (data) => {
      toast.success("Application submitted — pipeline running");
      setLocation(`/applications/${data.applicationId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const set = (field: keyof FormData) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = () => {
    if (!form.borrowerName || !form.loanAmount || !form.loanTermMonths) {
      toast.error("Please fill in all required fields");
      return;
    }
    submit.mutate({
      borrowerName: form.borrowerName,
      borrowerAge: form.borrowerAge ? Number(form.borrowerAge) : undefined,
      borrowerEmail: form.borrowerEmail || undefined,
      borrowerPhone: form.borrowerPhone || undefined,
      employerName: form.employerName || undefined,
      jobTitle: form.jobTitle || undefined,
      yearsEmployed: form.yearsEmployed ? Number(form.yearsEmployed) : undefined,
      annualIncome: form.annualIncome ? Number(form.annualIncome) : undefined,
      employmentType: form.employmentType || undefined,
      loanAmount: Number(form.loanAmount),
      loanTermMonths: Number(form.loanTermMonths),
      loanPurpose: form.loanPurpose || undefined,
      downPayment: form.downPayment ? Number(form.downPayment) : undefined,
      creditScore: form.creditScore ? Number(form.creditScore) : undefined,
      existingDebtsMonthly: form.existingDebtsMonthly ? Number(form.existingDebtsMonthly) : undefined,
      propertyAddress: form.propertyAddress || undefined,
      propertyType: form.propertyType || undefined,
      propertyValue: form.propertyValue ? Number(form.propertyValue) : undefined,
      propertySquareFeet: form.propertySquareFeet ? Number(form.propertySquareFeet) : undefined,
      propertyBedrooms: form.propertyBedrooms ? Number(form.propertyBedrooms) : undefined,
      propertyBathrooms: form.propertyBathrooms ? Number(form.propertyBathrooms) : undefined,
      propertyYearBuilt: form.propertyYearBuilt ? Number(form.propertyYearBuilt) : undefined,
      propertyState: form.propertyState || undefined,
      propertyZip: form.propertyZip || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-primary flex-shrink-0" />
          <span className="label-caps">New Application</span>
        </div>
        <h1 className="text-3xl font-black tracking-[-0.04em]">Mortgage Loan Application</h1>
      </div>

      <div className="px-8 py-8 max-w-3xl">
        {/* Step Indicator */}
        <div className="flex items-center gap-0 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide border transition-colors ${
                  step === s.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : step > s.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border"
                }`}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-8 ${step > i ? "bg-foreground" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Borrower */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="label-caps text-primary border-b border-primary pb-2">Borrower Information</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <Input value={form.borrowerName} onChange={set("borrowerName")} placeholder="Alexandra Chen" />
              </Field>
              <Field label="Age">
                <Input value={form.borrowerAge} onChange={set("borrowerAge")} type="number" placeholder="38" />
              </Field>
              <Field label="Email Address">
                <Input value={form.borrowerEmail} onChange={set("borrowerEmail")} type="email" placeholder="borrower@example.com" />
              </Field>
              <Field label="Phone Number">
                <Input value={form.borrowerPhone} onChange={set("borrowerPhone")} placeholder="555-0101" />
              </Field>
            </div>
          </div>
        )}

        {/* Step 1: Employment */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="label-caps text-primary border-b border-primary pb-2">Employment & Income</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Employer Name">
                <Input value={form.employerName} onChange={set("employerName")} placeholder="Apex Technologies Inc." />
              </Field>
              <Field label="Job Title">
                <Input value={form.jobTitle} onChange={set("jobTitle")} placeholder="Senior Engineer" />
              </Field>
              <Field label="Employment Type">
                <Select
                  value={form.employmentType}
                  onChange={set("employmentType")}
                  options={[
                    { value: "Full-time", label: "Full-time" },
                    { value: "Part-time", label: "Part-time" },
                    { value: "Self-employed", label: "Self-employed" },
                    { value: "Contract", label: "Contract" },
                    { value: "Retired", label: "Retired" },
                  ]}
                />
              </Field>
              <Field label="Years Employed">
                <Input value={form.yearsEmployed} onChange={set("yearsEmployed")} type="number" placeholder="5" />
              </Field>
              <Field label="Annual Income ($)" required>
                <Input value={form.annualIncome} onChange={set("annualIncome")} type="number" placeholder="120000" />
              </Field>
              <Field label="Existing Monthly Debts ($)">
                <Input value={form.existingDebtsMonthly} onChange={set("existingDebtsMonthly")} type="number" placeholder="800" />
              </Field>
            </div>
          </div>
        )}

        {/* Step 2: Loan */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="label-caps text-primary border-b border-primary pb-2">Loan Request</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Loan Amount ($)" required>
                <Input value={form.loanAmount} onChange={set("loanAmount")} type="number" placeholder="480000" />
              </Field>
              <Field label="Down Payment ($)">
                <Input value={form.downPayment} onChange={set("downPayment")} type="number" placeholder="120000" />
              </Field>
              <Field label="Loan Term">
                <Select
                  value={form.loanTermMonths}
                  onChange={set("loanTermMonths")}
                  options={[
                    { value: "360", label: "30 Years (360 months)" },
                    { value: "240", label: "20 Years (240 months)" },
                    { value: "180", label: "15 Years (180 months)" },
                    { value: "120", label: "10 Years (120 months)" },
                  ]}
                />
              </Field>
              <Field label="Loan Purpose">
                <Select
                  value={form.loanPurpose}
                  onChange={set("loanPurpose")}
                  options={[
                    { value: "Purchase", label: "Purchase" },
                    { value: "Refinance", label: "Refinance" },
                    { value: "Cash-out Refinance", label: "Cash-out Refinance" },
                    { value: "Construction", label: "Construction" },
                  ]}
                />
              </Field>
              <Field label="Credit Score">
                <Input value={form.creditScore} onChange={set("creditScore")} type="number" placeholder="750" />
              </Field>
            </div>
          </div>
        )}

        {/* Step 3: Property */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="label-caps text-primary border-b border-primary pb-2">Property Details</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Property Address">
                  <Input value={form.propertyAddress} onChange={set("propertyAddress")} placeholder="742 Evergreen Terrace, Austin, TX 78701" />
                </Field>
              </div>
              <Field label="Property Type">
                <Select
                  value={form.propertyType}
                  onChange={set("propertyType")}
                  options={[
                    { value: "Single Family", label: "Single Family" },
                    { value: "Condominium", label: "Condominium" },
                    { value: "Townhouse", label: "Townhouse" },
                    { value: "Multi-Family", label: "Multi-Family (2-4 units)" },
                    { value: "Manufactured", label: "Manufactured Home" },
                  ]}
                />
              </Field>
              <Field label="Estimated Value ($)">
                <Input value={form.propertyValue} onChange={set("propertyValue")} type="number" placeholder="600000" />
              </Field>
              <Field label="Square Footage">
                <Input value={form.propertySquareFeet} onChange={set("propertySquareFeet")} type="number" placeholder="2800" />
              </Field>
              <Field label="Year Built">
                <Input value={form.propertyYearBuilt} onChange={set("propertyYearBuilt")} type="number" placeholder="2018" />
              </Field>
              <Field label="Bedrooms">
                <Input value={form.propertyBedrooms} onChange={set("propertyBedrooms")} type="number" placeholder="4" />
              </Field>
              <Field label="Bathrooms">
                <Input value={form.propertyBathrooms} onChange={set("propertyBathrooms")} type="number" placeholder="3" />
              </Field>
              <Field label="State">
                <Input value={form.propertyState} onChange={set("propertyState")} placeholder="TX" />
              </Field>
              <Field label="ZIP Code">
                <Input value={form.propertyZip} onChange={set("propertyZip")} placeholder="78701" />
              </Field>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 text-sm font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submit.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-2 text-sm font-bold uppercase tracking-wide hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {submit.isPending ? "Submitting…" : "Submit Application"}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
