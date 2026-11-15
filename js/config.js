/* Configuração. Deixe supabaseUrl vazio para rodar em modo demonstração (dados só neste navegador).
   Para produção, copie a URL e a chave "publishable" do painel do Supabase (Project Settings > API) do projeto PRÓPRIO deste sistema.
   A chave publishable é pública por desenho: quem protege os dados são as regras do banco (RLS).
   NUNCA coloque aqui a chave "secret"/"service_role" nem a senha do banco.
   Ao ligar o banco, troque também, no index.html, "https://*.supabase.co" pelo endereço exato do projeto (política de conteúdo). */
window.SQC = window.SQC || {};
SQC.CONFIG = {
  supabaseUrl: 'https://mfhuowckqcjlbwfpinow.supabase.co',
  supabaseAnonKey: 'sb_publishable_IOK5N__gY_6kgk8C3uKDDw_Ksi0RSG9',
  semServiceWorker: false,
  vapidPublica: 'BDBnvS15u0xKoGNjIEI6pWcy4RH0KrvwIkUFAr8ouIGLdPp6dIaE5RAVQO3wTcurSHrK-DjkOKB8fXfYK3DPPMA'   // chave PÚBLICA dos avisos no celular (supabase/funcoes/avisos/LEIA-ME.md). A privada fica só nos segredos da função.
};
