<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Guards the STQC "Verbose SQL Error Message Disclosure" remediation.
 *
 * These are source checks, not HTTP tests, on purpose: they need no database, so
 * they run anywhere and cannot be skipped on a machine without MySQL. They exist
 * because the original fix was a convention ("don't echo the exception") that
 * nothing enforced, and it drifted back into ~9 controllers.
 */
class ErrorDisclosureGuardTest extends TestCase
{
    /** @return string[] */
    private function phpFilesIn(string $relativeDir): array
    {
        $base = dirname(__DIR__, 2).'/'.$relativeDir;
        $files = [];

        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($base));
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }

    /**
     * A client response must never carry the raw exception text. Exception
     * messages from libraries and PDO contain file paths, SQL and connection
     * detail; only BusinessException is written for an end user.
     */
    public function test_no_controller_returns_a_raw_exception_message_to_the_client(): void
    {
        // Types whose message is authored for an end user by construction. A catch
        // block for one of these may surface $e->getMessage(); anything else may
        // carry library or PDO text and must not.
        $safeTypes = [
            'BusinessException',
            'AuthenticationFailedException',
        ];

        $offenders = [];

        foreach ($this->phpFilesIn('app/Http/Controllers') as $file) {
            $lines = file($file);

            foreach ($lines as $number => $line) {
                // errorResponse($e->getMessage(), ...) and friends. Log:: calls are
                // fine — the whole point is that detail lives server-side.
                if (! preg_match('/(errorResponse|successResponse)\(\s*\$\w+->getMessage\(\)/', $line)) {
                    continue;
                }

                // Walk back to the catch that owns this line and read its types.
                $caughtSafely = false;
                for ($i = $number; $i >= max(0, $number - 8); $i--) {
                    if (preg_match('/\}\s*catch\s*\((?P<types>[^)]*)\)/', $lines[$i], $m)) {
                        foreach ($safeTypes as $safe) {
                            if (str_contains($m['types'], $safe)) {
                                $caughtSafely = true;
                            }
                        }
                        break;
                    }
                }

                if (! $caughtSafely) {
                    $offenders[] = str_replace(dirname(__DIR__, 2).'/', '', $file).':'.($number + 1);
                }
            }
        }

        $this->assertSame([], $offenders, implode("\n", array_merge(
            ['Controller responses must not contain a raw exception message.'],
            ['Throw App\Exceptions\BusinessException for a message the user should read,'],
            ['or use serverErrorResponse() which logs the detail and returns a reference id.'],
            ['Offending lines:'],
            $offenders
        )));
    }

    /**
     * app.debug decides how much detail a developer sees locally. It must never
     * decide what a client receives — that made one wrong APP_DEBUG in a deployed
     * .env enough to reproduce the audit finding in full.
     */
    public function test_app_debug_does_not_gate_any_client_response(): void
    {
        $offenders = [];

        foreach ($this->phpFilesIn('app/Http') as $file) {
            $contents = file_get_contents($file);
            if (str_contains($contents, "config('app.debug')")) {
                $offenders[] = str_replace(dirname(__DIR__, 2).'/', '', $file);
            }
        }

        $this->assertSame([], $offenders,
            "app.debug must not appear in the HTTP layer; it must not influence a response body.\n".
            implode("\n", $offenders));
    }

    /**
     * Request input must not reach paginate(). An unbounded LIMIT is a memory
     * exhaustion vector and a negative one is the MySQL syntax error that produced
     * the verbose SQL error in the first place. Use resolvePerPage().
     */
    public function test_no_request_input_reaches_paginate_directly(): void
    {
        $offenders = [];

        foreach ($this->phpFilesIn('app') as $file) {
            foreach (file($file) as $number => $line) {
                if (preg_match('/paginate\(\s*.*\$request->(input|get|query)\(/', $line)
                    && ! str_contains($line, 'resolvePerPage')) {
                    $offenders[] = str_replace(dirname(__DIR__, 2).'/', '', $file).':'.($number + 1);
                }
            }
        }

        $this->assertSame([], $offenders,
            "Pass page size through resolvePerPage(); never hand request input to paginate().\n".
            implode("\n", $offenders));
    }
}
