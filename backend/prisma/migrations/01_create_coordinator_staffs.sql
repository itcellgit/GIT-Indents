CREATE TABLE IF NOT EXISTS public.coordinator_staffs
(
    id bigint NOT NULL,
    coordinator_id bigint NOT NULL,
    staff_id bigint NOT NULL,
    department_id bigint NOT NULL,
    start_date character varying(255) COLLATE pg_catalog."default",
    end_date character varying(255) COLLATE pg_catalog."default",
    level character varying(12) COLLATE pg_catalog."default",
    status character varying(8) COLLATE pg_catalog."default",
    created_at timestamp without time zone,
    updated_at timestamp without time zone
)

TABLESPACE pg_default;


DROP TABLE IF EXISTS public.coordinator_staffs;

CREATE TABLE public.coordinator_staffs (
    id BIGSERIAL PRIMARY KEY,
    coordinator_id BIGINT NOT NULL,
    staff_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    start_date VARCHAR(255),
    end_date VARCHAR(255),
    level VARCHAR(12),
    status VARCHAR(8),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);