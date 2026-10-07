import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Mail, MapPin, Phone, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormField } from '@/components/ui/form'
import { SelectField, TextField } from '@/components/ui/fields'
import { Badge } from '@/components/ui/badge'
import { ErrorState, SectionCard } from '@/components/common/misc'
import { useCompany, useFiscalYears } from '@/hooks/queries'
import { useApiMutation } from '@/hooks/mutations'
import { authApi } from '@/lib/api/endpoints'
import { useAuth } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/format'

type Translate = (key: string, options?: Record<string, unknown>) => string

const userSchema = (t: Translate) =>
  z.object({
    email: z.string().email(t('company.errEmail')),
    password: z.string().min(8, t('company.errPassword')),
    fullName: z.string().min(2, t('company.errFullName')).max(120),
    role: z.string().min(1, t('company.errRole')),
  })

type UserFormValues = z.infer<ReturnType<typeof userSchema>>

export function CompanyPage() {
  const { t } = useTranslation()
  const companyQuery = useCompany()
  const yearsQuery = useFiscalYears()
  const { session, isAdmin } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('company.title')}
        description={t('company.description')}
        breadcrumbs={[{ label: t('nav.groups.configuration') }, { label: t('company.breadcrumb') }]}
        actions={
          isAdmin ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> {t('company.inviteUser')}
            </Button>
          ) : null
        }
      />

      {companyQuery.error ? (
        <ErrorState
          error={companyQuery.error}
          onRetry={() => companyQuery.refetch()}
          title={t('company.couldNotLoad')}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            title={t('company.companyCard')}
            description={t('company.companyCardHint')}
            className="lg:col-span-2"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label={t('common.name')} value={companyQuery.data?.name} />
              <Detail label={t('company.legalName')} value={companyQuery.data?.legalName} />
              <Detail
                label={t('company.taxRegistration')}
                value={companyQuery.data?.taxRegistrationNumber}
              />
              <Detail label={t('company.baseCurrency')} value={companyQuery.data?.baseCurrencyCode} />
              <Detail
                label={t('company.fiscalYearStart')}
                value={
                  companyQuery.data
                    ? t('company.monthNumber', { month: companyQuery.data.fiscalYearStartMonth })
                    : undefined
                }
              />
              <Detail
                label={t('common.status')}
                value={companyQuery.data?.isActive ? t('common.active') : t('common.inactive')}
              />
            </div>
          </SectionCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('company.contact')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {companyQuery.data?.addressLine1 ?? t('common.dash')}
                  <br />
                  {[companyQuery.data?.city, companyQuery.data?.state, companyQuery.data?.postalCode]
                    .filter(Boolean)
                    .join(', ') || t('common.dash')}
                  <br />
                  {companyQuery.data?.country ?? ''}
                </span>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {companyQuery.data?.phone ?? t('common.dash')}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {companyQuery.data?.email ?? t('common.dash')}
              </p>
            </CardContent>
          </Card>

          <SectionCard
            title={t('company.fiscalYears')}
            description={t('company.fiscalYearsHint')}
            className="lg:col-span-2"
          >
            <div className="space-y-2">
              {(yearsQuery.data ?? []).map((year) => (
                <div key={year.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{year.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(year.startDate)} → {formatDate(year.endDate)}
                    </p>
                  </div>
                  <Badge variant={year.isClosed ? 'secondary' : 'success'}>
                    {year.isClosed ? t('company.closed') : t('company.open')}
                  </Badge>
                </div>
              ))}
              {(yearsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('company.noFiscalYears')}</p>
              ) : null}
            </div>
          </SectionCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" /> {t('company.yourSession')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label={t('company.signedInAs')} value={session?.fullName} />
              <Detail label={t('common.email')} value={session?.email} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('company.roles')}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(session?.roles ?? []).map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const registerUser = useApiMutation({
    mutationFn: authApi.register,
    successMessage: t('company.userCreated'),
    invalidate: [],
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema(t)),
    defaultValues: { email: '', password: '', fullName: '', role: 'Accountant' },
  })

  const onSubmit = (values: UserFormValues) => {
    registerUser.mutate(values, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
      onError: (error) => {
        if (error.fieldErrors) {
          for (const [field, messages] of Object.entries(error.fieldErrors)) {
            form.setError(field as keyof UserFormValues, { message: messages[0] })
          }
        } else {
          toast.error(error.message)
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('company.inviteTitle')}</DialogTitle>
          <DialogDescription>{t('company.inviteDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="invite-user" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <TextField
                  label={t('company.fullName')}
                  placeholder={t('company.fullNamePlaceholder')}
                  required
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <SelectField
                  label={t('company.role')}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={ROLES.map((role) => ({ value: role, label: role }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <TextField
                  label={t('common.email')}
                  type="email"
                  placeholder={t('company.emailPlaceholder')}
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
                  label={t('company.temporaryPassword')}
                  type="text"
                  placeholder={t('company.temporaryPasswordPlaceholder')}
                  required
                  {...field}
                />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="invite-user" loading={registerUser.isPending}>
            {t('company.createUser')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
