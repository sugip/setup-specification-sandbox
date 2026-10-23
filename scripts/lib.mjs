import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CATALOG_PATH = join(ROOT, 'spec/catalog.yaml');
export const TENANTS_DIR = join(ROOT, 'spec/tenants');

export const rel = (path) => relative(ROOT, path);

const readYaml = (path) => YAML.parse(readFileSync(path, 'utf8'));

export function loadSpec() {
  const catalog = readYaml(CATALOG_PATH);
  const tenants = readdirSync(TENANTS_DIR)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => {
      const path = join(TENANTS_DIR, name);
      return { path, stem: basename(name, '.yaml'), data: readYaml(path) };
    });
  return { catalog, tenants };
}

// カタログの木を表示順の行リストに展開する。
// feature 行は親機能（level2 の場合）と、所属するグループの制約を参照できる。
export function flattenCatalog(catalog) {
  const rows = [];
  const features = new Map();

  const walkFeature = (node, prefix, depth, parentId) => {
    const id = `${prefix}${node.id}`;
    const row = { kind: 'feature', id, depth, parentId, ...pickFeature(node) };
    rows.push(row);
    features.set(id, row);
    for (const child of node.children ?? []) walkFeature(child, `${id}.`, depth + 1, id);
  };

  const walk = (nodes, prefix, depth) => {
    for (const node of nodes) {
      if (node.items) {
        const id = `${prefix}${node.id}`;
        rows.push({ kind: 'group', id, depth, label: node.label, note: node.note, constraints: node.constraints });
        walk(node.items, `${id}.`, depth + 1);
      } else {
        walkFeature(node, prefix, depth, null);
      }
    }
  };

  walk(catalog.items, '', 0);
  return { rows, features };
}

const pickFeature = ({ label, note, toggle, constraints, data, optional_field, params }) => ({
  label,
  note,
  toggle,
  constraints,
  data,
  optionalField: optional_field,
  params: params ?? {},
});

// true / false / { enabled, params, note } を同じ形にそろえる。
export function normalizeSetting(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return { enabled: value, params: {} };
  return { enabled: value.enabled, params: value.params ?? {}, note: value.note };
}

// テナントの差分設定をカタログに当てて、全機能の最終状態を求める。
// state: required（必須） / on / off / na（親機能が無効のため対象外）
export function resolveTenant(features, tenant) {
  const settings = tenant.features ?? {};
  const resolved = {};
  for (const [id, feature] of features) {
    const parentState = feature.parentId ? resolved[feature.parentId].state : null;
    const setting = normalizeSetting(settings[id]);
    let state;
    if (parentState === 'off' || parentState === 'na') state = 'na';
    else if (feature.toggle === 'required') state = 'required';
    else state = setting?.enabled ? 'on' : 'off';

    const active = state === 'on' || state === 'required';
    resolved[id] = {
      state,
      params: active ? setting?.params ?? {} : {},
      note: setting?.note,
    };
  }
  for (const { feature, description } of tenant.customizations ?? []) {
    if (resolved[feature]) (resolved[feature].customizations ??= []).push(description);
  }
  return resolved;
}
