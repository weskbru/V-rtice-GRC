/** Access administration (US8, T176-T180) — spans `core/identity`,
 * `core/authorization` and `core/organizations`; none of the three is a
 * sole owner, so their combined admin-surface text lives together here
 * rather than being split three ways for its own sake. */
export const admin = {
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  emailAlreadyInUse: 'Este endereço de e-mail já está em uso.',
  cannotDeactivateSelf: 'Você não pode desativar sua própria conta.',
  localCredentialNotFound:
    'Este usuário não possui uma credencial local para redefinição de senha.',
  invalidRoleIds: 'Um ou mais papéis informados não existem.',
  roleNameAlreadyInUse: 'Já existe um papel com este nome.',
  /** F-68 — the platform owns a system role WHOLE: name, description and
   * permission set. This exact string is the `detail` of the RFC 9457
   * problem body, and `test/integration/system-role-immutability.spec.ts`
   * asserts it so that "422 because it is a system role" is distinguishable
   * from "422 for any other reason". */
  systemRoleImmutable:
    'Papéis do sistema são definidos pela plataforma: o nome, a descrição e o conjunto de permissões não podem ser alterados.',
  roleHasAssignedUsers: 'Este papel está atribuído a ao menos um usuário e não pode ser excluído.',
  systemRoleNotDeletable: 'Papéis do sistema não podem ser excluídos.',
  invalidPermissionIdentifiers: 'Um ou mais identificadores de permissão informados não existem.',
  orgUnitCodeAlreadyInUse: 'Este código de unidade organizacional já está em uso.',
  parentOrgUnitNotFound: 'A unidade organizacional pai informada não existe ou está inativa.',
  reparentWouldCreateCycle:
    'Esta operação tornaria a unidade organizacional sua própria ancestral.',
  orgUnitHasActiveDescendant:
    'Esta unidade organizacional possui uma unidade descendente ativa e não pode ser desativada.',
  scopeGrantInconsistent:
    'Uma concessão do tipo UNIT exige uma unidade organizacional; uma concessão do tipo GLOBAL não pode informar uma unidade.',
  scopeGrantOrgUnitNotFound:
    'A unidade organizacional informada para a concessão de escopo não existe.',
  scopeGrantDuplicate: 'Esta concessão de escopo já existe para este usuário.',
} as const;

/** `CreateUserRequestDto`/`UpdateUserRequestDto` (T180, US8,
 * `POST|PATCH /admin/users[/{userId}]`). */
export const adminUser = {
  email: {
    isEmail: 'Informe um endereço de e-mail válido.',
    maxLength: 'O e-mail deve ter no máximo 320 caracteres.',
  },
  fullName: {
    isString: 'O nome completo deve ser um texto.',
    length: 'O nome completo deve ter entre 1 e 200 caracteres.',
  },
  jobTitle: {
    isString: 'O cargo deve ser um texto.',
    maxLength: 'O cargo deve ter no máximo 200 caracteres.',
  },
  primaryOrgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  initialPassword: {
    isString: 'A senha inicial deve ser um texto.',
    length: 'A senha inicial deve ter entre 12 e 256 caracteres.',
  },
  roleIds: { isUuid: 'Um dos papéis informados é inválido.' },
} as const;

/** `SetUserStatusRequestDto` (T180, `PUT /admin/users/{userId}/status`). */
export const setUserStatus = {
  status: { isIn: 'O status informado é inválido.' },
  reason: {
    isString: 'O motivo deve ser um texto.',
    maxLength: 'O motivo deve ter no máximo 500 caracteres.',
  },
} as const;

/** `ResetUserPasswordRequestDto` (T180,
 * `PUT /admin/users/{userId}/password`). */
export const resetUserPassword = {
  newPassword: {
    isString: 'A nova senha deve ser um texto.',
    length: 'A nova senha deve ter entre 12 e 256 caracteres.',
  },
} as const;

/** `ReplaceUserRolesRequestDto` (T180,
 * `PUT /admin/users/{userId}/roles`). */
export const replaceUserRoles = {
  roleIds: { isUuid: 'Um dos papéis informados é inválido.' },
} as const;

/** `GrantOrgScopeRequestDto` (T180,
 * `POST /admin/users/{userId}/scope-grants`). */
export const grantOrgScope = {
  scopeType: { isIn: 'O tipo de escopo informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
} as const;

/** `ListAdminUsersQueryDto` — `GET /admin/users` (T180). */
export const listAdminUsersQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O termo de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  roleId: { isUuid: 'O papel informado é inválido.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `WriteRoleRequestDto`/`UpdateRoleRequestDto` (T180, US8,
 * `POST|PATCH /admin/roles[/{roleId}]`). */
export const writeRole = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 100 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 500 caracteres.',
  },
  permissionIdentifiers: {
    isString: 'Um dos identificadores de permissão informados é inválido.',
  },
} as const;

/** `ListRolesQueryDto` — `GET /admin/roles` (T180). */
export const listRolesQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

/** `ListPermissionsQueryDto` — `GET /admin/permissions` (T180). */
export const listPermissionsQuery = {
  resource: { maxLength: 'O recurso informado deve ter no máximo 64 caracteres.' },
} as const;

/** `CreateOrgUnitRequestDto`/`UpdateOrgUnitRequestDto` (T180, US8,
 * `POST|PATCH /admin/org-units[/{orgUnitId}]`). */
export const writeOrgUnit = {
  code: {
    isString: 'O código deve ser um texto.',
    length: 'O código deve ter entre 1 e 50 caracteres.',
  },
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 200 caracteres.',
  },
  parentId: { isUuid: 'A unidade organizacional pai informada é inválida.' },
} as const;

/** `SetOrgUnitStatusRequestDto` (T180,
 * `PUT /admin/org-units/{orgUnitId}/status`). */
export const setOrgUnitStatus = {
  status: { isIn: 'O status informado é inválido.' },
} as const;

/** `AdminOrgUnitsQueryDto` — `GET /admin/org-units` (T180). */
export const adminOrgUnitsQuery = {
  status: { isIn: 'O status informado é inválido.' },
} as const;
