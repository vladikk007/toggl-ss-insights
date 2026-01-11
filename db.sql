-- public.t_organization definition

-- Drop table

-- DROP TABLE public.t_organization;

CREATE TABLE public.t_organization (
	t_organization_id int8 NOT NULL,
	"name" varchar NOT NULL,
	CONSTRAINT t_organization_pk PRIMARY KEY (t_organization_id)
);


-- public.t_user definition

-- Drop table

-- DROP TABLE public.t_user;

CREATE TABLE public.t_user (
	t_user_id int8 NOT NULL,
	email varchar NOT NULL,
	"name" varchar NOT NULL,
	CONSTRAINT t_user_pk PRIMARY KEY (t_user_id)
);


-- public.t_workspace definition

-- Drop table

-- DROP TABLE public.t_workspace;

CREATE TABLE public.t_workspace (
	t_workspace_id int8 NOT NULL,
	t_organization_id int8 NOT NULL,
	"name" varchar NOT NULL,
	CONSTRAINT t_workspace_pk PRIMARY KEY (t_workspace_id),
	CONSTRAINT t_workspace_t_organization_fk FOREIGN KEY (t_organization_id) REFERENCES public.t_organization(t_organization_id)
);


-- public.t_client definition

-- Drop table

-- DROP TABLE public.t_client;

CREATE TABLE public.t_client (
	t_client_id int8 NOT NULL,
	t_workspace_id int8 NOT NULL,
	"name" varchar NOT NULL,
	archived bool NOT NULL,
	CONSTRAINT t_client_pk PRIMARY KEY (t_client_id),
	CONSTRAINT t_client_t_workspace_fk FOREIGN KEY (t_workspace_id) REFERENCES public.t_workspace(t_workspace_id)
);


-- public.t_project definition

-- Drop table

-- DROP TABLE public.t_project;

CREATE TABLE public.t_project (
	t_project_id int8 NOT NULL,
	t_workspace_id int8 NOT NULL,
	t_client_id int8 NULL,
	"name" varchar NOT NULL,
	CONSTRAINT t_project_pk PRIMARY KEY (t_project_id),
	CONSTRAINT t_project_t_client_fk FOREIGN KEY (t_client_id) REFERENCES public.t_client(t_client_id),
	CONSTRAINT t_project_t_workspace_fk FOREIGN KEY (t_workspace_id) REFERENCES public.t_workspace(t_workspace_id)
);


-- public.t_time_entry definition

-- Drop table

-- DROP TABLE public.t_time_entry;

CREATE TABLE public.t_time_entry (
	t_time_entry_id int8 NOT NULL,
	t_user_id int8 NOT NULL,
	t_workspace_id int8 NOT NULL,
	t_project_id int8 NULL,
	description text NOT NULL,
	"start" timestamp NOT NULL,
	duration_seconds int4 NULL,
	CONSTRAINT t_time_entry_pk PRIMARY KEY (t_time_entry_id),
	CONSTRAINT t_time_entry_t_project_fk FOREIGN KEY (t_project_id) REFERENCES public.t_project(t_project_id),
	CONSTRAINT t_time_entry_t_user_fk FOREIGN KEY (t_user_id) REFERENCES public.t_user(t_user_id),
	CONSTRAINT t_time_entry_t_workspace_fk FOREIGN KEY (t_workspace_id) REFERENCES public.t_workspace(t_workspace_id)
);
CREATE INDEX t_time_entry_start_idx ON public.t_time_entry USING btree (start);


-- public.t_export definition

-- Drop table

-- DROP TABLE public.t_export;

CREATE TABLE public.t_export (
	id int8 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL,
	sybri_user_name varchar(64) NOT NULL,
	from_date date NOT NULL,
	"data" text NOT NULL,
	created timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	processed bool DEFAULT false NOT NULL,
	CONSTRAINT t_export_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger t_export_after_insert_delete_duplicates after
insert
    on
    public.t_export for each row execute function t_export_delete_duplicates();


-- public.t_export foreign keys

ALTER TABLE public.t_export ADD CONSTRAINT t_export_sybri_user_name_fkey FOREIGN KEY (sybri_user_name) REFERENCES public.sybri_user(sybri_user_name);