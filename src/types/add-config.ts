export interface AddConfig {
  features: Array<
    'cicd' | 'slack' | 'discord' | 'linting' | 'formatting' | 'git-hooks'
  >;
}
