-- 0036 Corrige o numero no comentario do indice de identidade do ponto
--
-- A 0031 diz "as 3.586 linhas". Sao 3.577.
--
-- 3.586 e a soma das PARTES de `Terminal` em todas as linhas. Mas 9 linhas
-- repetem o mesmo meio dentro da propria celula — `CIELO / CIELO`. Como a
-- identidade de um ponto e (establishment_id, capture_method_id), as duas
-- ocorrencias nao podem virar duas linhas: a segunda violaria este mesmo indice.
--
-- 3.586 conta partes brutas; 3.577 conta linhas gravadas. Medido, nao estimado:
-- a primeira importacao da base real gravou exatamente 3.577.
--
-- Migration aplicada nao se edita — por isso a correcao vem aqui, e nao na 0031.
-- Um numero errado num comentario nao quebra nada hoje; quebra a confianca em
-- todos os outros numeros comentados no schema, que e pior.

comment on index public.establishment_capture_points_identidade is
  'Identidade de um ponto de captura: (establishment_id, capture_method_id).
   Sem isto explicito, a segunda importacao inseriria de novo os 3.577 vinculos
   em vez de reconhece-los. Sao 3.586 partes brutas em `Terminal` e 3.577
   vinculos: 9 linhas repetem o mesmo meio na propria celula e a repeticao e
   deduplicada — e contada em import_jobs.duplicated_capture_methods, porque
   defeito da origem silenciado volta em toda importacao.';
