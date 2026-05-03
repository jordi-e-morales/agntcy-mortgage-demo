import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Cpu,
  Zap,
  Globe,
  Server,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  Activity,
} from "lucide-react";

type Provider = "gemini" | "openai" | "anthropic" | "ollama";

const PROVIDER_META: Record<
  Provider,
  { label: string; icon: string; color: string; description: string; localOnly?: boolean }
> = {
  gemini: {
    label: "Google Gemini",
    icon: "G",
    color: "bg-blue-600",
    description: "Google's Gemini models via API. Best structured JSON output.",
  },
  openai: {
    label: "OpenAI",
    icon: "O",
    color: "bg-emerald-600",
    description: "GPT-4o and GPT-4 series. Industry-standard reliability.",
  },
  anthropic: {
    label: "Anthropic Claude",
    icon: "A",
    color: "bg-orange-600",
    description: "Claude 3.5 and Claude 4 series. Excellent reasoning.",
  },
  ollama: {
    label: "Ollama (Local)",
    icon: "⬡",
    color: "bg-zinc-700",
    description: "Run models locally. Zero cost, full privacy, no API key needed.",
    localOnly: true,
  },
};

export default function Settings() {
  const { data: settings, isLoading, refetch } = trpc.settings.getLLMSettings.useQuery();
  const { data: mlHealth, refetch: refetchML } = trpc.settings.getMLHealth.useQuery();
  const updateSettings = trpc.settings.updateLLMSettings.useMutation({
    onSuccess: () => {
      toast.success("LLM settings saved successfully");
      void refetch();
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });
  const testOllama = trpc.settings.testOllamaConnection.useMutation();

  const [provider, setProvider] = useState<Provider>("gemini");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [useBuiltIn, setUseBuiltIn] = useState(true);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);

  // Populate form from loaded settings
  useEffect(() => {
    if (!settings) return;
    setProvider(settings.provider as Provider);
    setModelName(settings.modelName);
    setOllamaBaseUrl(settings.ollamaBaseUrl ?? "http://localhost:11434");
    setTemperature(settings.temperature);
    setMaxTokens(settings.maxTokens);
    setUseBuiltIn(settings.useBuiltIn);
  }, [settings]);

  // Reset model when provider changes
  useEffect(() => {
    if (!settings) return;
    const models = settings.availableModels[provider] ?? [];
    if (models.length > 0 && !models.includes(modelName)) {
      setModelName(models[0]!);
    }
  }, [provider]);

  const handleTestOllama = async () => {
    const result = await testOllama.mutateAsync({ baseUrl: ollamaBaseUrl });
    setOllamaConnected(result.connected);
    if (result.connected) {
      setOllamaModels(result.models ?? []);
      toast.success(`Ollama connected — ${result.models?.length ?? 0} models available`);
    } else {
      toast.error(`Ollama not reachable: ${result.error}`);
    }
  };

  const handleSave = () => {
    updateSettings.mutate({
      provider,
      modelName,
      apiKey: apiKey || undefined,
      ollamaBaseUrl,
      temperature,
      maxTokens,
      useBuiltIn,
    });
  };

  const availableModels = settings?.availableModels[provider] ?? [];
  const effectiveModels = provider === "ollama" && ollamaModels.length > 0 ? ollamaModels : availableModels;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 bg-zinc-100 animate-pulse mb-4" />
        <div className="h-4 w-96 bg-zinc-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="border-b-2 border-black pb-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-red-600" />
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-zinc-500">
            System Configuration
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-black">Settings</h1>
        <p className="text-zinc-600 mt-1 text-sm">
          Configure the LLM provider powering all pipeline agents and monitor ML model status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: LLM Settings */}
        <div className="lg:col-span-2 space-y-8">

          {/* Built-in vs External toggle */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-black">LLM Source</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Use the platform built-in API or bring your own provider</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${!useBuiltIn ? "text-black" : "text-zinc-400"}`}>External</span>
                <Switch
                  checked={useBuiltIn}
                  onCheckedChange={setUseBuiltIn}
                />
                <span className={`text-xs font-medium ${useBuiltIn ? "text-black" : "text-zinc-400"}`}>Built-in</span>
              </div>
            </div>

            {useBuiltIn ? (
              <div className="border border-zinc-200 p-4 bg-zinc-50">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-black">Manus Built-in API Active</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Using the platform-managed Gemini 2.5 Flash API. No API key required.
                  Switch to External to use your own provider or run models locally.
                </p>
              </div>
            ) : (
              <div className="border border-amber-200 p-4 bg-amber-50">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-black">External Provider Mode</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Configure your provider below. For local demos, use Ollama with no API key.
                </p>
              </div>
            )}
          </section>

          {/* Provider Selection */}
          {!useBuiltIn && (
            <>
              <section>
                <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-black mb-4">Provider</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(PROVIDER_META) as [Provider, typeof PROVIDER_META[Provider]][]).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setProvider(key)}
                      className={`text-left p-4 border-2 transition-all ${
                        provider === key
                          ? "border-black bg-black text-white"
                          : "border-zinc-200 hover:border-zinc-400 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 ${meta.color} flex items-center justify-center text-white text-xs font-bold`}>
                          {meta.icon}
                        </div>
                        <span className="text-sm font-bold">{meta.label}</span>
                        {meta.localOnly && (
                          <Badge variant="outline" className={`text-xs ml-auto ${provider === key ? "border-zinc-500 text-zinc-300" : ""}`}>
                            Local
                          </Badge>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed ${provider === key ? "text-zinc-300" : "text-zinc-500"}`}>
                        {meta.description}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Model Selection */}
              <section>
                <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-black mb-4">Model</h2>
                {provider === "ollama" ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={handleTestOllama}
                        disabled={testOllama.isPending}
                        className="shrink-0"
                      >
                        {testOllama.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                    {ollamaConnected === true && (
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        Connected — {ollamaModels.length} models available
                      </div>
                    )}
                    {ollamaConnected === false && (
                      <div className="flex items-center gap-2 text-xs text-red-600">
                        <XCircle className="w-3 h-3" />
                        Cannot connect to Ollama. Make sure it's running locally.
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Model</Label>
                      {effectiveModels.length > 0 ? (
                        <Select value={modelName} onValueChange={setModelName}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {effectiveModels.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={modelName}
                          onChange={(e) => setModelName(e.target.value)}
                          placeholder="e.g. llama3.2"
                          className="font-mono text-sm"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <Select value={modelName} onValueChange={setModelName}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {effectiveModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </section>

              {/* API Key (not for Ollama) */}
              {provider !== "ollama" && (
                <section>
                  <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-black mb-4">API Key</h2>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={settings?.apiKeySet ? "••••••••••••••••••••• (key saved)" : "Enter your API key"}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {settings?.apiKeySet && (
                    <p className="text-xs text-zinc-500 mt-1">
                      A key is already saved. Enter a new value to replace it, or leave blank to keep the existing key.
                    </p>
                  )}
                </section>
              )}

              {/* Advanced: Temperature + Max Tokens */}
              <section>
                <h2 className="text-sm font-bold tracking-[0.15em] uppercase text-black mb-4">Advanced Parameters</h2>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label className="text-xs text-zinc-600">Temperature</Label>
                      <span className="text-xs font-mono font-bold text-black">{temperature.toFixed(2)}</span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={[temperature]}
                      onValueChange={([v]) => setTemperature(v!)}
                    />
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>Deterministic</span>
                      <span>Creative</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Keep at 0.1 for structured JSON output. Higher values may break JSON schema compliance.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label className="text-xs text-zinc-600">Max Tokens</Label>
                      <span className="text-xs font-mono font-bold text-black">{maxTokens.toLocaleString()}</span>
                    </div>
                    <Slider
                      min={512}
                      max={16384}
                      step={512}
                      value={[maxTokens]}
                      onValueChange={([v]) => setMaxTokens(v!)}
                    />
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>512</span>
                      <span>16,384</span>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="bg-black text-white hover:bg-zinc-800 px-8 h-11 font-bold tracking-wide"
            >
              {updateSettings.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </div>

        {/* Right column: Status panels */}
        <div className="space-y-6">

          {/* Active Configuration */}
          <div className="border-2 border-black p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-red-600" />
              <h3 className="text-xs font-bold tracking-[0.15em] uppercase">Active Config</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Source</span>
                <span className="font-bold text-black">
                  {settings?.useBuiltIn ? "Manus Built-in" : "External"}
                </span>
              </div>
              <div className="border-t border-zinc-100" />
              <div className="flex justify-between">
                <span className="text-zinc-500">Provider</span>
                <span className="font-bold text-black capitalize">{settings?.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Model</span>
                <span className="font-mono font-bold text-black text-right max-w-[140px] truncate">{settings?.modelName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Temperature</span>
                <span className="font-mono font-bold text-black">{settings?.temperature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Max Tokens</span>
                <span className="font-mono font-bold text-black">{settings?.maxTokens?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ML Model Status */}
          <div className="border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-600" />
                <h3 className="text-xs font-bold tracking-[0.15em] uppercase">ML Models</h3>
              </div>
              <button onClick={() => void refetchML()} className="text-zinc-400 hover:text-black">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Inference Server */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-600">Inference Server</span>
                </div>
                {mlHealth?.online ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Offline
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100" />

              {/* XGBoost */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-black">XGBoost</div>
                  <div className="text-xs text-zinc-500">Credit Risk Model</div>
                </div>
                {mlHealth?.xgboostLoaded ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-xs border-0">Loaded</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-zinc-400">Not loaded</Badge>
                )}
              </div>

              {/* GNN */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-black">GNN (GCN)</div>
                  <div className="text-xs text-zinc-500">Fraud Detection</div>
                </div>
                {mlHealth?.gnnLoaded ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-xs border-0">Loaded</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-zinc-400">Not loaded</Badge>
                )}
              </div>

              <div className="border-t border-zinc-100 pt-2">
                <p className="text-xs text-zinc-400 font-mono">{mlHealth?.serverUrl}</p>
              </div>
            </div>
          </div>

          {/* Ollama Quick Guide */}
          {!useBuiltIn && provider === "ollama" && (
            <div className="border border-zinc-200 p-5 bg-zinc-50">
              <h3 className="text-xs font-bold tracking-[0.15em] uppercase mb-3">Ollama Quick Start</h3>
              <div className="space-y-2 text-xs text-zinc-600">
                <div className="flex gap-2">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-red-600" />
                  <span>Install: <code className="bg-white px-1 font-mono">brew install ollama</code></span>
                </div>
                <div className="flex gap-2">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-red-600" />
                  <span>Start: <code className="bg-white px-1 font-mono">ollama serve</code></span>
                </div>
                <div className="flex gap-2">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-red-600" />
                  <span>Pull: <code className="bg-white px-1 font-mono">ollama pull llama3.2</code></span>
                </div>
                <div className="flex gap-2">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-red-600" />
                  <span>Recommended for demos: <code className="bg-white px-1 font-mono">llama3.2</code> or <code className="bg-white px-1 font-mono">mistral</code></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
