import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Command, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormField } from '@/components/ui/form'
import { TextField } from '@/components/ui/fields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, isLoggingIn, loginError, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'admin@demo.local', password: 'Admin@12345' },
  })

  // Already signed in? Bounce to the dashboard (rendering <Navigate> keeps this out of render-phase side effects).
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values)
      navigate('/', { replace: true })
    } catch {
      /* surfaced via loginError */
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
            <Command className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Ledgerly</p>
            <p className="text-xs text-sidebar-foreground/60">Accounting System client</p>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Double-entry accounting, from ledger to financial statements.
          </h1>
          <ul className="space-y-3 text-sm text-sidebar-foreground/80">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              JWT bearer auth with role-based access (Admin, Accountant, AR/AP Clerk, Viewer).
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Every invoice, bill, payment and depreciation run posts through one balanced journal engine.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Statements, aging and cash flow computed live from the ledger.
            </li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          React · TanStack Query · TanStack Table · React Hook Form
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Sign in</h2>
              <p className="text-sm text-muted-foreground">
                Use the seeded demo administrator to explore the ledger.
              </p>
            </div>

            {loginError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            ) : null}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <TextField label="Email" type="email" autoComplete="username" placeholder="you@company.com" required {...field} />
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <TextField
                      label="Password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                      {...field}
                    />
                  )}
                />
                <Button type="submit" className="w-full" loading={isLoggingIn}>
                  <LockKeyhole className="h-4 w-4" />
                  Sign in
                </Button>
              </form>
            </Form>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Demo credentials</p>
              <p className="mt-1 font-mono">admin@demo.local / Admin@12345</p>
              <p className="mt-2">
                Running without the .NET API? Start the client with <span className="font-mono">npm run dev:mock</span> to
                use the bundled in-browser mock of the same endpoints.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
