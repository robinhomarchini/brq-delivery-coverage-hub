# ADR 0001 — Repositório local antes do Supabase

## Status

Superado pelo baseline Supabase descrito em `docs/project/ARCHITECTURE.md`.

## Decisão

O MVP utiliza dados mockados e um contrato de repositório. A interface não acessa
diretamente nenhum cliente de banco.

## Consequências

A demonstração funciona sem infraestrutura e uma integração Supabase futura pode
ser adicionada como novo adaptador, preservando as telas.
