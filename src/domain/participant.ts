import { comparisonKey, normalizeText } from './text';

export interface Participant {
  /** 0-based position among the valid participants (drives the file index and the code). */
  readonly index: number;
  /** Normalized display name. Letter case is preserved as written in the list. */
  readonly name: string;
  /** Every column of the source row (normalized), keyed by column name. */
  readonly fields: Readonly<Record<string, string>>;
  /** Index of the first participant with the same comparison key, when this one repeats it. */
  readonly duplicateOf: number | null;
  /** 1-based row/line/paragraph of the source file. */
  readonly sourceRow: number;
}

export interface RawParticipantRow {
  readonly name: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly sourceRow: number;
}

export interface DuplicateGroup {
  /** Comparison key shared by the group (no accents, no case). */
  readonly key: string;
  /** Participant indexes, first occurrence first. */
  readonly indexes: readonly number[];
}

export interface ParticipantReport {
  readonly valid: number;
  readonly emptyDiscarded: number;
  readonly duplicateGroups: readonly DuplicateGroup[];
  /** Participants that repeat an earlier one (total members of all groups minus one each). */
  readonly duplicateCount: number;
}

export interface ParticipantList {
  readonly participants: readonly Participant[];
  readonly report: ParticipantReport;
}

/** Normalizes the rows, discards empty names and marks (never removes) duplicates. */
export function buildParticipantList(rows: readonly RawParticipantRow[]): ParticipantList {
  const firstByKey = new Map<string, number>();
  const groups = new Map<string, number[]>();
  const participants: Participant[] = [];
  let emptyDiscarded = 0;

  for (const row of rows) {
    const name = normalizeText(row.name);
    if (name.length === 0) {
      emptyDiscarded += 1;
      continue;
    }
    const index = participants.length;
    const key = comparisonKey(name);
    const first = firstByKey.get(key);
    if (first === undefined) {
      firstByKey.set(key, index);
      groups.set(key, [index]);
    } else {
      groups.get(key)?.push(index);
    }
    const fields: Record<string, string> = {};
    for (const [column, value] of Object.entries(row.fields ?? {})) {
      fields[column] = normalizeText(value);
    }
    participants.push({
      index,
      name,
      fields,
      duplicateOf: first ?? null,
      sourceRow: row.sourceRow,
    });
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([key, indexes]) => ({ key, indexes }));

  return {
    participants,
    report: {
      valid: participants.length,
      emptyDiscarded,
      duplicateGroups,
      duplicateCount: duplicateGroups.reduce((sum, group) => sum + group.indexes.length - 1, 0),
    },
  };
}

/** Replaces one participant's name (quick edit) and recomputes the duplicate marks. */
export function renameParticipant(
  list: ParticipantList,
  index: number,
  newName: string,
): ParticipantList {
  const rows: RawParticipantRow[] = list.participants.map((participant) => ({
    name: participant.index === index ? newName : participant.name,
    fields: participant.fields,
    sourceRow: participant.sourceRow,
  }));
  const rebuilt = buildParticipantList(rows);
  return {
    participants: rebuilt.participants,
    report: {
      ...rebuilt.report,
      emptyDiscarded: list.report.emptyDiscarded + rebuilt.report.emptyDiscarded,
    },
  };
}
