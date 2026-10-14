'use client';

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@vertice/design-system/components';
import { FormField } from '@vertice/design-system/components';

import { risksApi } from '../api';

import type { RiskStatement } from '../types';

export interface RiskCausesConsequencesProps {
  riskId: string;
  initialCauses: readonly RiskStatement[];
  initialConsequences: readonly RiskStatement[];
  etag: string;
  onSaved: (result: { kind: StatementKind; items: readonly RiskStatement[]; etag: string }) => void;
}

type StatementKind = 'cause' | 'consequence';

interface ActiveEditor {
  kind: StatementKind;
  index: number | null;
  value: string;
}

function StatementList({
  kind,
  title,
  description,
  emptyLabel,
  items,
  activeEditor,
  savingKind,
  onActivateEdit,
  onActivateNew,
  onChangeValue,
  onConfirm,
  onCancel,
  onRequestRemove,
  fieldError,
}: {
  kind: StatementKind;
  title: string;
  description: string;
  emptyLabel: string;
  items: readonly RiskStatement[];
  activeEditor: ActiveEditor | null;
  savingKind: StatementKind | null;
  onActivateEdit: (index: number) => void;
  onActivateNew: () => void;
  onChangeValue: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRequestRemove: (index: number) => void;
  fieldError: string | null;
}): React.JSX.Element {
  const locked = activeEditor !== null && (activeEditor.kind !== kind || savingKind !== null);
  const editingThisKind = activeEditor?.kind === kind ? activeEditor : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col gap-2">
        {items.length === 0 && !editingThisKind ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : null}

        {items.map((item, index) => {
          if (editingThisKind?.index === index) {
            return (
              <EditorRow
                key={item.id}
                kind={kind}
                isNew={false}
                value={editingThisKind.value}
                saving={savingKind === kind}
                error={fieldError}
                onChangeValue={onChangeValue}
                onConfirm={onConfirm}
                onCancel={onCancel}
                fieldLabel={risks.causesConsequences.rowLabel(kind, index)}
              />
            );
          }
          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <p className="text-sm text-foreground">{item.description}</p>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={locked || activeEditor !== null}
                  aria-label={risks.causesConsequences.editAction(kind, index)}
                  onClick={() => onActivateEdit(index)}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={locked || activeEditor !== null}
                  aria-label={
                    kind === 'cause'
                      ? risks.causesConsequences.removeCause(index)
                      : risks.causesConsequences.removeConsequence(index)
                  }
                  onClick={() => onRequestRemove(index)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {editingThisKind?.index === null ? (
          <EditorRow
            kind={kind}
            isNew
            value={editingThisKind.value}
            saving={savingKind === kind}
            error={fieldError}
            onChangeValue={onChangeValue}
            onConfirm={onConfirm}
            onCancel={onCancel}
            fieldLabel={risks.causesConsequences.rowLabel(kind, items.length)}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={activeEditor !== null}
          onClick={onActivateNew}
        >
          <Plus aria-hidden="true" className="size-4" />
          {kind === 'cause'
            ? risks.causesConsequences.addCause
            : risks.causesConsequences.addConsequence}
        </Button>
        {activeEditor !== null && activeEditor.kind !== kind ? (
          <p className="text-xs text-muted-foreground">{risks.causesConsequences.lockedHint}</p>
        ) : null}
      </div>
    </div>
  );
}

function EditorRow({
  kind,
  isNew,
  value,
  saving,
  error,
  onChangeValue,
  onConfirm,
  onCancel,
  fieldLabel,
}: {
  kind: StatementKind;
  isNew: boolean;
  value: string;
  saving: boolean;
  error: string | null;
  onChangeValue: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  fieldLabel: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-status-info-border bg-status-info-bg/40 p-3">
      <span className="text-xs font-medium text-status-info-fg">
        {isNew ? risks.causesConsequences.newBadge(kind) : risks.causesConsequences.editingBadge}
      </span>
      <FormField label={fieldLabel} error={error ?? undefined}>
        {(a11y) => (
          <Input
            {...a11y}
            autoFocus
            value={value}
            onChange={(event) => onChangeValue(event.target.value)}
            disabled={saving}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={onConfirm}>
          {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {risks.causesConsequences.confirmAction}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          {common.actions.cancel}
        </Button>
      </div>
    </div>
  );
}

export function RiskCausesConsequences({
  riskId,
  initialCauses,
  initialConsequences,
  etag,
  onSaved,
}: RiskCausesConsequencesProps): React.JSX.Element {
  const [causes, setCauses] = useState<readonly RiskStatement[]>(initialCauses);
  const [consequences, setConsequences] = useState<readonly RiskStatement[]>(initialConsequences);
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [savingKind, setSavingKind] = useState<StatementKind | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ kind: StatementKind; index: number } | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  const listFor = (kind: StatementKind): readonly RiskStatement[] =>
    kind === 'cause' ? causes : consequences;
  const setListFor = (kind: StatementKind, items: readonly RiskStatement[]): void => {
    if (kind === 'cause') setCauses(items);
    else setConsequences(items);
  };

  async function persist(kind: StatementKind, descriptions: readonly string[]): Promise<boolean> {
    setBanner(null);
    setSavingKind(kind);
    try {
      const result =
        kind === 'cause'
          ? await risksApi.replaceCauses(riskId, descriptions, etag)
          : await risksApi.replaceConsequences(riskId, descriptions, etag);
      setListFor(kind, result.items);
      onSaved({ kind, items: result.items, etag: result.etag });
      feedback.success(risks.causesConsequences.saveSuccess(kind));
      return true;
    } catch (submitError) {
      setBanner(
        submitError instanceof ApiError && submitError.problem.status === 409
          ? risks.causesConsequences.conflictError
          : risks.causesConsequences.saveError,
      );
      return false;
    } finally {
      setSavingKind(null);
    }
  }

  function handleConfirm(): void {
    if (!activeEditor) return;
    const trimmed = activeEditor.value.trim();
    if (!trimmed) {
      setFieldError(risks.causesConsequences.rowRequired(activeEditor.kind));
      return;
    }
    setFieldError(null);
    const current = listFor(activeEditor.kind).map((item) => item.description);
    const next =
      activeEditor.index === null
        ? [...current, trimmed]
        : current.map((description, index) =>
            index === activeEditor.index ? trimmed : description,
          );

    void persist(activeEditor.kind, next).then((ok) => {
      if (ok) setActiveEditor(null);
    });
  }

  function handleCancel(): void {
    setActiveEditor(null);
    setFieldError(null);
  }

  async function handleConfirmRemove(): Promise<void> {
    if (!pendingRemove) return;
    setRemoving(true);
    const next = listFor(pendingRemove.kind)
      .filter((_, index) => index !== pendingRemove.index)
      .map((item) => item.description);
    const ok = await persist(pendingRemove.kind, next);
    setRemoving(false);
    if (ok) setPendingRemove(null);
  }

  const sideBySide = causes.length + consequences.length <= 12;

  return (
    <div className="flex flex-col gap-4">
      {banner ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {banner}
        </p>
      ) : null}

      <div className={cn('grid gap-6', sideBySide && 'lg:grid-cols-2')}>
        <StatementList
          kind="cause"
          title={risks.causesConsequences.causesTitle}
          description={risks.causesConsequences.causesDescription}
          emptyLabel={risks.causesConsequences.emptyCauses}
          items={causes}
          activeEditor={activeEditor}
          savingKind={savingKind}
          fieldError={activeEditor?.kind === 'cause' ? fieldError : null}
          onActivateEdit={(index) =>
            setActiveEditor({ kind: 'cause', index, value: causes[index]!.description })
          }
          onActivateNew={() => setActiveEditor({ kind: 'cause', index: null, value: '' })}
          onChangeValue={(value) =>
            setActiveEditor((current) => (current ? { ...current, value } : current))
          }
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onRequestRemove={(index) => setPendingRemove({ kind: 'cause', index })}
        />

        <StatementList
          kind="consequence"
          title={risks.causesConsequences.consequencesTitle}
          description={risks.causesConsequences.consequencesDescription}
          emptyLabel={risks.causesConsequences.emptyConsequences}
          items={consequences}
          activeEditor={activeEditor}
          savingKind={savingKind}
          fieldError={activeEditor?.kind === 'consequence' ? fieldError : null}
          onActivateEdit={(index) =>
            setActiveEditor({
              kind: 'consequence',
              index,
              value: consequences[index]!.description,
            })
          }
          onActivateNew={() => setActiveEditor({ kind: 'consequence', index: null, value: '' })}
          onChangeValue={(value) =>
            setActiveEditor((current) => (current ? { ...current, value } : current))
          }
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onRequestRemove={(index) => setPendingRemove({ kind: 'consequence', index })}
        />
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={
          pendingRemove ? risks.causesConsequences.removeConfirm.title(pendingRemove.kind) : ''
        }
        description={
          pendingRemove
            ? risks.causesConsequences.removeConfirm.description(pendingRemove.kind)
            : ''
        }
        labels={{
          confirm:
            pendingRemove?.kind === 'cause'
              ? risks.causesConsequences.removeCause(pendingRemove.index)
              : pendingRemove
                ? risks.causesConsequences.removeConsequence(pendingRemove.index)
                : '',
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="destructive"
        isConfirming={removing}
        onConfirm={() => void handleConfirmRemove()}
      />
    </div>
  );
}
