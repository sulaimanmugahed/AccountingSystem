/**
 * Form-aware control wrappers: each one plugs a shadcn control into the
 * `FormField` (react-hook-form Controller) context so validation messages,
 * ids and aria attributes wire themselves up automatically.
 */
import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface BaseFieldProps {
  label?: React.ReactNode
  description?: React.ReactNode
  className?: string
  placeholder?: string
  required?: boolean
}

export function FieldShell({
  label,
  description,
  required,
  className,
  children,
}: BaseFieldProps & { children: React.ReactNode }) {
  return (
    <FormItem className={className}>
      {label ? (
        <FormLabel>
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </FormLabel>
      ) : null}
      <FormControl>{children}</FormControl>
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormMessage />
    </FormItem>
  )
}

interface TextFieldProps extends BaseFieldProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | number
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function TextField({ label, description, className, required, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} description={description} required={required} className={className}>
      <Input {...props} />
    </FieldShell>
  )
}

export function TextAreaField({ label, description, className, required, ...props }: BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} description={description} required={required} className={className}>
      <Textarea {...props} />
    </FieldShell>
  )
}

export function NumberField({ label, description, className, required, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} description={description} required={required} className={className}>
      <Input type="number" step="any" inputMode="decimal" className="text-right tabular-nums" {...props} />
    </FieldShell>
  )
}

export function DateField({ label, description, className, required, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} description={description} required={required} className={className}>
      <Input type="date" {...props} />
    </FieldShell>
  )
}

export interface Option {
  value: string | number
  label: string
  disabled?: boolean
}

interface SelectFieldProps extends BaseFieldProps {
  value?: string | number | null
  onChange?: (value: string) => void
  options: Option[]
  allowEmpty?: string
  disabled?: boolean
}

export function SelectField({
  label,
  description,
  className,
  required,
  options,
  allowEmpty,
  value,
  onChange,
  placeholder,
  disabled,
}: SelectFieldProps) {
  const stringValue = value === null || value === undefined || value === '' ? undefined : String(value)
  return (
    <FieldShell label={label} description={description} required={required} className={className}>
      <Select value={stringValue} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? <SelectItem value="__empty__">{allowEmpty}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

interface CheckboxFieldProps extends BaseFieldProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
}

export function CheckboxField({
  label,
  description,
  className,
  checked,
  onChange,
  disabled,
}: CheckboxFieldProps) {
  return (
    <FormItem className={cn('flex flex-row items-start gap-3 space-y-0 rounded-md border p-3', className)}>
      <FormControl>
        <Checkbox checked={!!checked} onCheckedChange={(value) => onChange?.(value === true)} disabled={disabled} />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel className="cursor-pointer">{label}</FormLabel>
        {description ? <FormDescription>{description}</FormDescription> : null}
      </div>
      <FormMessage />
    </FormItem>
  )
}

interface ComboboxFieldProps extends BaseFieldProps {
  value?: string | null
  onChange?: (value: string | null) => void
  options: Option[]
  disabled?: boolean
  emptyMessage?: string
  allowClear?: boolean
}

/**
 * Searchable single-select built on Popover — used wherever the list of
 * accounts / customers / vendors is too long for a plain <Select>.
 */
export function ComboboxField({
  label,
  description,
  className,
  required,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  emptyMessage = 'No results.',
  allowClear = true,
}: ComboboxFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const selected = options.find((option) => String(option.value) === String(value ?? ''))

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options.slice(0, 100)
    return options.filter((option) => option.label.toLowerCase().includes(term)).slice(0, 100)
  }, [options, search])

  return (
    <FieldShell label={label} description={description} required={required} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? selected.label : (placeholder ?? 'Select…')}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search…"
              className="h-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {allowClear && value ? (
              <button
                type="button"
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => {
                  onChange?.(null)
                  setOpen(false)
                }}
              >
                Clear selection
              </button>
            ) : null}
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange?.(String(option.value))
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      String(option.value) === String(value ?? '') ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </FieldShell>
  )
}
