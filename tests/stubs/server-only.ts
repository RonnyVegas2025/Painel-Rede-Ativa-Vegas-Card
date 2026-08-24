// `server-only` existe para QUEBRAR o build se um módulo de servidor for
// importado num Client Component — a garantia é do bundler, e ela continua
// valendo em `next build`. No vitest não há fronteira cliente/servidor para
// proteger, e o pacote lança na importação.
//
// Substituir o pacote aqui não afrouxa nada: o que ele protege é a montagem do
// bundle, e o teste não monta bundle. Trocar o `import "server-only"` do
// adaptador por conveniência de teste, sim, afrouxaria.
export {};
