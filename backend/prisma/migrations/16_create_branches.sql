CREATE TABLE IF NOT EXISTS public.branches
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    branch_name character varying COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT now(),
    "Updated_at" timestamp without time zone DEFAULT now(),
    CONSTRAINT branches_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;