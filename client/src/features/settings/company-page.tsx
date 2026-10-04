import { useState } from 'react'
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

const userSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Passwords must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required').max(120),
  role: z.string().min(1, 'Select a role'),
})

type UserFormValues = z.infer<typeof userSchema>

export function CompanyPage() {
  const companyQuery = useCompany()
  const yearsQuery = useFiscalYears()
  const { session, isAdmin } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Company profile"
        description="Base currency, fiscal year configuration and access details for this tenant."
        breadcrumbs={[{ label: 'Configuration' }, { label: 'Company' }]}
        actions={
          isAdmin ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          ) : null
        }
      />

      {companyQuery.error ? (
        <ErrorState error={companyQuery.error} onRetry={() => companyQuery.refetch()} title="Could not load the company profile" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Company" description="Legal entity details" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Name" value={companyQuery.data?.name} />
              <Detail label="Legal name" value={companyQuery.data?.legalName} />
              <Detail label="Tax registration" value={companyQuery.data?.taxRegistrationNumber} />
              <Detail label="Base currency" value={companyQuery.data?.baseCurrencyCode} />
              <Detail
                label="Fiscal year start"
                value={companyQuery.data ? `Month ${companyQuery.data.fiscalYearStartMonth}` : undefined}
              />
              <Detail label="Status" value={companyQuery.data?.isActive ? 'Active' : 'Inactive'} />
            </div>
          </SectionCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {companyQuery.data?.addressLine1 ?? '—'}
                  <br />
                  {[companyQuery.data?.city, companyQuery.data?.state, companyQuery.data?.postalCode]
                    .filter(Boolean)
                    .join(', ') || '—'}
                  <br />
                  {companyQuery.data?.country ?? ''}
                </span>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {companyQuery.data?.phone ?? '—'}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {companyQuery.data?.email ?? '—'}
              </p>
            </CardContent>
          </Card>

          <SectionCard title="Fiscal years" description="Periods drive posting validation" className="lg:col-span-2">
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
                    {year.isClosed ? 'Closed' : 'Open'}
                  </Badge>
                </div>
              ))}
              {(yearsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No fiscal years configured.</p>
              ) : null}
            </div>
          </SectionCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" /> Your session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Signed in as" value={session?.fullName} />
              <Detail label="Email" value={session?.email} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Roles</p>
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
  const registerUser = useApiMutation({
    mutationFn: authApi.register,
    successMessage: 'User created and assigned to the company.',
    invalidate: [],
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
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
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            Creates an Identity account bound to this company and assigns one of the built-in roles.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="invite-user" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => <TextField label="Full name" placeholder="Dana Accountant" required {...field} />}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <SelectField
                  label="Role"
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
                <TextField label="Email" type="email" placeholder="user@company.com" required {...field} />
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <TextField label="Temporary password" type="text" placeholder="At least 8 characters" required {...field} />
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="invite-user" loading={registerUser.isPending}>
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
