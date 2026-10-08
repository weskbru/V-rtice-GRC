export const errors = {
  invalidCredentials: 'E-mail ou senha incorretos.',
  authenticationRequired: 'Autenticação necessária.',
  forbidden: 'Você não tem permissão para executar esta ação.',
  rateLimited: 'Muitas tentativas. Tente novamente mais tarde.',
  currentPasswordIncorrect: 'A senha atual informada está incorreta.',
  passwordPolicyViolation: 'A nova senha não atende à política de senhas.',
  payloadTooLargeTitle: 'Arquivo muito grande',
  fileTooLarge: 'O arquivo enviado excede o tamanho máximo permitido.',
  httpStatusTitle: {
    400: 'Requisição inválida',
    401: 'Não autorizado',
    403: 'Acesso negado',
    404: 'Não encontrado',
    409: 'Conflito',
    422: 'Não processável',
    429: 'Muitas requisições',
    500: 'Erro interno do servidor',
  },
  requestFailedTitle: 'Falha na requisição',
  genericTitle: 'Algo deu errado',
  genericMessage:
    'Não foi possível concluir a solicitação. Tente novamente e, se o problema persistir, entre em contato com o suporte.',
} as const;
