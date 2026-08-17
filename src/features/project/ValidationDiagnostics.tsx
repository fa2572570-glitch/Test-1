import React, { useState } from 'react';
import { ShieldCheck, Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { runFoundationTestSuite, TestResult } from '../../utils/test-suite';

export const ValidationDiagnostics: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const testResults = await runFoundationTestSuite();
      setResults(testResults);
    } catch (err) {
      console.error('Test suite failed', err);
    } finally {
      setIsRunning(false);
    }
  };

  const allPassed = results && results.length > 0 && results.every((r) => r.passed);

  return (
    <Card variant="subtle" padding="md" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Core Architecture & Schema Diagnostics
            </h3>
            {results && (
              <Badge variant={allPassed ? 'success' : 'error'} size="sm">
                {allPassed
                  ? `All ${results.length} Tests Passing`
                  : `${results.filter((r) => r.passed).length}/${results.length} Passing`}
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Automated verification of Schema v1.0.0, IndexedDB isolation, normalized coordinate invariants, and image identity preservation.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRunTests}
          isLoading={isRunning}
          leftIcon={<Play className="w-3.5 h-3.5" />}
        >
          Run Verification Suite
        </Button>
      </div>

      {results ? (
        <div className="flex flex-col gap-2.5">
          {results.map((res, i) => (
            <div
              key={i}
              className={`flex items-start justify-between p-3 rounded-lg border text-xs ${
                res.passed
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                  : 'bg-rose-950/40 border-rose-800 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {res.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200">{res.name}</span>
                    <Badge variant="neutral" size="sm">
                      {res.category}
                    </Badge>
                  </div>
                  <p className="text-zinc-400 text-[11px] mt-0.5">{res.message}</p>
                </div>
              </div>

              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {res.durationMs}ms
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-zinc-400 bg-zinc-900/60 rounded-lg border border-zinc-800">
          Click "Run Verification Suite" to validate live database isolation, normalized bounds check, and migration engines.
        </div>
      )}
    </Card>
  );
};
