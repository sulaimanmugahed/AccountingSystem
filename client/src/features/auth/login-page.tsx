import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

type LoginValues = { email: string; password: string }

export function LoginPage() {
  const { t } = useTranslation()
  const { login, isLoggingIn, loginError, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const loginSchema = z.object({
    email: z.string().min(1, t('auth.emailRequired')).email(t('validate.invalidEmail')),
    password: z.string().min(1, t('auth.passwordRequired')),
  })

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
            <p className="text-lg font-semibold text-white">{t('app.name')}</p>
            <p className="text-xs text-sidebar-foreground/60">{t('auth.clientTagline')}</p>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight text-white">{t('auth.heroTitle')}</h1>
          <ul className="space-y-3 text-sm text-sidebar-foreground/80">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {t('auth.heroPoint1')}
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {t('auth.heroPoint2')}
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {t('auth.heroPoint3')}
            </li>
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/50">{t('auth.heroTech')}</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{t('auth.signIn')}</h2>
              <p className="text-sm text-muted-foreground">{t('auth.signInSubtitle')}</p>
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
                    <TextField
                      label={t('auth.email')}
                      type="email"
                      autoComplete="username"
                      placeholder={t('auth.emailPlaceholder')}
                      required
                      {...field}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <TextField
                      label={t('auth.password')}
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
                  {t('auth.signIn')}
                </Button>
              </form>
            </Form>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{t('auth.demoTitle')}</p>
              <p className="mt-1 font-mono" dir="ltr">admin@demo.local / Admin@12345</p>
              <p className="mt-2">
                {t('auth.demoHint', { command: 'npm run dev:mock' })
                  .split('npm run dev:mock')
                  .map((part, index, parts) => (
                    <React.Fragment key={index}>
                      {part}
                      {index < parts.length - 1 ? <span className="font-mono">npm run dev:mock</span> : null}
                    </React.Fragment>
                  ))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
