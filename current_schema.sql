--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: route_day_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.route_day_enum AS ENUM (
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
);


--
-- Name: route_lapso_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.route_lapso_status_enum AS ENUM (
    'en_curso',
    'completado',
    'incompleto',
    'vencido'
);


--
-- Name: task_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_priority_enum AS ENUM (
    'baja',
    'media',
    'alta',
    'crítica'
);


--
-- Name: task_state_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_state_enum AS ENUM (
    'Completada',
    'Pendiente',
    'Atrasada',
    'Incompleta'
);


--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role_enum AS ENUM (
    'admin',
    'editor',
    'visitante',
    'rutero'
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: audit_log_cleanup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_log_cleanup() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  deleted_count bigint;
begin
  delete from public.audit_log
  where performed_at < now() - interval '1 year';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


--
-- Name: close_expired_route_lapsos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_expired_route_lapsos() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET row_security TO 'off'
    AS $$
declare
  closed_count integer;
begin
  update public.route_lapso
  set
    status = 'vencido',
    closed_at = coalesce(closed_at, now()),
    updated_at = now()
  where status = 'en_curso'
    and (
      end_at <= now()
      or start_at < (
        date_trunc('week', now() at time zone 'America/Costa_Rica')
        at time zone 'America/Costa_Rica'
      )
    );

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS public.user_role_enum
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select up.role
  from public.user_profile up
  where up.auth_user_id = auth.uid()
  limit 1;
$$;


--
-- Name: enforce_max_evidence_per_record(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_max_evidence_per_record() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  current_count integer;
begin
  select count(*)
    into current_count
  from public.evidence e
  where e.record_id = new.record_id
    and e.evidence_id <> coalesce(new.evidence_id, -1);

  if current_count >= 6 then
    raise exception 'No se permiten mas de 6 evidencias por registro.';
  end if;

  return new;
end;
$$;


--
-- Name: fn_audit_log(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_audit_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_auth_user_id uuid;
  v_user_id      bigint;
  v_record_id    bigint;
  v_action       text;
  v_description  text;
  v_pk_col       text := coalesce(TG_ARGV[0], 'id');
  v_old_record   jsonb;
  v_new_record   jsonb;
begin
  -- Resolve the acting user.
  v_auth_user_id := auth.uid();
  if v_auth_user_id is not null then
    select up.user_id into v_user_id
    from public.user_profile up
    where up.auth_user_id = v_auth_user_id
    limit 1;
  end if;

  -- Determine action, record PK, and row snapshots.
  if TG_OP = 'INSERT' then
    v_action := 'INSERT';
    execute format('select ($1).%I::bigint', v_pk_col) into v_record_id using NEW;
    v_description := 'Creo registro en ' || TG_TABLE_NAME;
    v_new_record := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_action := 'UPDATE';
    execute format('select ($1).%I::bigint', v_pk_col) into v_record_id using NEW;
    v_description := 'Actualizo registro en ' || TG_TABLE_NAME;
    v_old_record := to_jsonb(OLD);
    v_new_record := to_jsonb(NEW);
  elsif TG_OP = 'DELETE' then
    v_action := 'DELETE';
    execute format('select ($1).%I::bigint', v_pk_col) into v_record_id using OLD;
    v_description := 'Elimino registro en ' || TG_TABLE_NAME;
    v_old_record := to_jsonb(OLD);
  end if;

  insert into public.audit_log (
    auth_user_id,
    user_id,
    action,
    table_name,
    record_id,
    description,
    old_record,
    new_record
  ) values (
    v_auth_user_id,
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    v_record_id,
    v_description,
    v_old_record,
    v_new_record
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$_$;


--
-- Name: is_rutero_assigned_to_establishment(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_rutero_assigned_to_establishment(target_establishment_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.user_profile up
    join public.route r
      on r.assigned_user = up.user_id
    join public.establishment e
      on e.route_id = r.route_id
    where up.auth_user_id = auth.uid()
      and up.role = 'rutero'
      and e.establishment_id = target_establishment_id
  );
$$;


--
-- Name: is_rutero_assigned_to_product(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_rutero_assigned_to_product(target_product_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
  select exists (
    select 1
    from public.user_profile up
    join public.route r
      on r.assigned_user = up.user_id
    join public.establishment e
      on e.route_id = r.route_id
    join public.products_establishment pe
      on pe.establishment_id = e.establishment_id
    where up.auth_user_id = auth.uid()
      and up.role = 'rutero'
      and pe.product_id = target_product_id
  );
$$;


--
-- Name: prevent_duplicate_check_record_per_active_lapso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_duplicate_check_record_per_active_lapso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.lapso_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.check_record cr
    where cr.lapso_id = new.lapso_id
      and cr.establishment_id = new.establishment_id
      and cr.product_id = new.product_id
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'Ya existe un registro para este producto en este establecimiento durante el lapso activo. Puedes editar el registro existente.';
  end if;

  return new;
end;
$$;


--
-- Name: route_day_options(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.route_day_options() RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select enum_range(null::public.route_day_enum)::text[];
$$;


--
-- Name: user_profile_protect_self_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_profile_protect_self_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  actor_role public.user_role_enum;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  actor_role := public.current_user_role();

  if actor_role = 'admin' then
    return new;
  end if;

  if actor_role = 'editor' then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Editor no puede cambiar rol, estado ni vinculacion auth';
    end if;
    return new;
  end if;

  if new.auth_user_id is distinct from auth.uid() then
    raise exception 'No autorizado para actualizar este perfil';
  end if;

  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.is_active is distinct from old.is_active
     or new.phone_num is distinct from old.phone_num
     or new.auth_user_id is distinct from old.auth_user_id
     or new.company_id is distinct from old.company_id then
    raise exception 'Solo puedes actualizar tu nombre';
  end if;

  return new;
end
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: lock_top_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


--
-- Name: objects_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


--
-- Name: objects_update_level_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_level_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_delete_cleanup(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_delete_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'stores metadata for pkce logins';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    log_id bigint NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    auth_user_id uuid,
    user_id bigint,
    action text NOT NULL,
    table_name text,
    record_id bigint,
    description text,
    old_record jsonb,
    new_record jsonb
);


--
-- Name: audit_log_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_log_id_seq OWNED BY public.audit_log.log_id;


--
-- Name: check_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_record (
    record_id bigint NOT NULL,
    system_inventory integer,
    real_inventory integer,
    evidence_num integer,
    comments text,
    time_date timestamp without time zone DEFAULT now() NOT NULL,
    product_id bigint NOT NULL,
    user_id bigint NOT NULL,
    establishment_id bigint NOT NULL,
    lapso_id bigint,
    CONSTRAINT check_record_non_negative_inv CHECK ((((system_inventory IS NULL) OR (system_inventory >= 0)) AND ((real_inventory IS NULL) OR (real_inventory >= 0)) AND ((evidence_num IS NULL) OR (evidence_num >= 0))))
);


--
-- Name: check_record_record_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.check_record_record_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: check_record_record_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.check_record_record_id_seq OWNED BY public.check_record.record_id;


--
-- Name: company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company (
    company_id bigint NOT NULL,
    name character varying(120) NOT NULL,
    direction character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    report_emails text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: company_company_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_company_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_company_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_company_id_seq OWNED BY public.company.company_id;


--
-- Name: establishment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.establishment (
    establishment_id bigint NOT NULL,
    name character varying(120) NOT NULL,
    route_id bigint,
    direction character varying(255),
    lat numeric(9,6),
    long numeric(9,6),
    is_active boolean DEFAULT true NOT NULL,
    province character varying(120) NOT NULL,
    canton character varying(120) NOT NULL,
    district character varying(120) NOT NULL,
    format text,
    zone text
);


--
-- Name: establishment_establishment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.establishment_establishment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: establishment_establishment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.establishment_establishment_id_seq OWNED BY public.establishment.establishment_id;


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence (
    evidence_id bigint NOT NULL,
    url text NOT NULL,
    record_id bigint NOT NULL,
    geo_info text
);


--
-- Name: evidence_evidence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.evidence_evidence_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidence_evidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.evidence_evidence_id_seq OWNED BY public.evidence.evidence_id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    product_id bigint NOT NULL,
    sku character varying(80) NOT NULL,
    name character varying(120) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    company_id bigint NOT NULL
);


--
-- Name: product_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_product_id_seq OWNED BY public.product.product_id;


--
-- Name: products_establishment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products_establishment (
    establishment_id bigint NOT NULL,
    product_id bigint NOT NULL
);


--
-- Name: route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route (
    route_id bigint NOT NULL,
    nombre character varying(120) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    visit_period character varying(40),
    day public.route_day_enum,
    assigned_user bigint
);


--
-- Name: route_lapso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route_lapso (
    lapso_id bigint NOT NULL,
    route_id bigint NOT NULL,
    user_id bigint NOT NULL,
    duration_days integer NOT NULL,
    start_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_at timestamp with time zone NOT NULL,
    status public.route_lapso_status_enum DEFAULT 'en_curso'::public.route_lapso_status_enum NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT route_lapso_closed_when_final_chk CHECK ((((status = 'en_curso'::public.route_lapso_status_enum) AND (closed_at IS NULL)) OR ((status <> 'en_curso'::public.route_lapso_status_enum) AND (closed_at IS NOT NULL)))),
    CONSTRAINT route_lapso_duration_days_check CHECK ((duration_days >= 1)),
    CONSTRAINT route_lapso_end_after_start_chk CHECK ((end_at > start_at))
);


--
-- Name: route_lapso_lapso_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.route_lapso_lapso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: route_lapso_lapso_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.route_lapso_lapso_id_seq OWNED BY public.route_lapso.lapso_id;


--
-- Name: route_route_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.route_route_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: route_route_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.route_route_id_seq OWNED BY public.route.route_id;


--
-- Name: task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task (
    task_id bigint NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    priority public.task_priority_enum NOT NULL,
    due_to timestamp without time zone
);


--
-- Name: task_task_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_task_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_task_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_task_id_seq OWNED BY public.task.task_id;


--
-- Name: user_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profile (
    user_id bigint NOT NULL,
    name character varying(120) NOT NULL,
    role public.user_role_enum NOT NULL,
    phone_num character varying(30),
    auth_user_id uuid NOT NULL,
    photo_path text,
    email text,
    is_active boolean DEFAULT true NOT NULL,
    company_id bigint,
    CONSTRAINT user_profile_company_only_visitante_chk CHECK (((company_id IS NULL) OR (role = 'visitante'::public.user_role_enum)))
);


--
-- Name: user_profile_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_profile_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_profile_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_profile_user_id_seq OWNED BY public.user_profile.user_id;


--
-- Name: user_session_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_session_log (
    session_log_id bigint NOT NULL,
    user_id bigint,
    auth_user_id uuid NOT NULL,
    login_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    logout_at timestamp with time zone,
    user_agent text
);


--
-- Name: user_session_log_session_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_session_log_session_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_session_log_session_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_session_log_session_log_id_seq OWNED BY public.user_session_log.session_log_id;


--
-- Name: user_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tasks (
    user_id bigint NOT NULL,
    task_id bigint NOT NULL,
    task_state public.task_state_enum DEFAULT 'Pendiente'::public.task_state_enum NOT NULL,
    comments text
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: iceberg_namespaces; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_namespaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    catalog_id uuid NOT NULL
);


--
-- Name: iceberg_tables; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namespace_id uuid NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    location text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remote_table_id text,
    shard_key text,
    shard_id text,
    catalog_id uuid NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: audit_log log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN log_id SET DEFAULT nextval('public.audit_log_log_id_seq'::regclass);


--
-- Name: check_record record_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_record ALTER COLUMN record_id SET DEFAULT nextval('public.check_record_record_id_seq'::regclass);


--
-- Name: company company_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company ALTER COLUMN company_id SET DEFAULT nextval('public.company_company_id_seq'::regclass);


--
-- Name: establishment establishment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishment ALTER COLUMN establishment_id SET DEFAULT nextval('public.establishment_establishment_id_seq'::regclass);


--
-- Name: evidence evidence_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence ALTER COLUMN evidence_id SET DEFAULT nextval('public.evidence_evidence_id_seq'::regclass);


--
-- Name: product product_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN product_id SET DEFAULT nextval('public.product_product_id_seq'::regclass);


--
-- Name: route route_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route ALTER COLUMN route_id SET DEFAULT nextval('public.route_route_id_seq'::regclass);


--
-- Name: route_lapso lapso_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_lapso ALTER COLUMN lapso_id SET DEFAULT nextval('public.route_lapso_lapso_id_seq'::regclass);


--
-- Name: task task_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task ALTER COLUMN task_id SET DEFAULT nextval('public.task_task_id_seq'::regclass);


--
-- Name: user_profile user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile ALTER COLUMN user_id SET DEFAULT nextval('public.user_profile_user_id_seq'::regclass);


--
-- Name: user_session_log session_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session_log ALTER COLUMN session_log_id SET DEFAULT nextval('public.user_session_log_session_log_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: check_record check_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_record
    ADD CONSTRAINT check_record_pkey PRIMARY KEY (record_id);


--
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (company_id);


--
-- Name: establishment establishment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishment
    ADD CONSTRAINT establishment_pkey PRIMARY KEY (establishment_id);


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_pkey PRIMARY KEY (evidence_id);


--
-- Name: product product_company_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_company_id_sku_key UNIQUE (company_id, sku);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (product_id);


--
-- Name: products_establishment products_establishment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_establishment
    ADD CONSTRAINT products_establishment_pkey PRIMARY KEY (establishment_id, product_id);


--
-- Name: route_lapso route_lapso_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_lapso
    ADD CONSTRAINT route_lapso_pkey PRIMARY KEY (lapso_id);


--
-- Name: route route_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_pkey PRIMARY KEY (route_id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (task_id);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (user_id);


--
-- Name: user_session_log user_session_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session_log
    ADD CONSTRAINT user_session_log_pkey PRIMARY KEY (session_log_id);


--
-- Name: user_tasks user_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_pkey PRIMARY KEY (user_id, task_id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: iceberg_namespaces iceberg_namespaces_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_pkey PRIMARY KEY (id);


--
-- Name: iceberg_tables iceberg_tables_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: check_record_establishment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_record_establishment_id_idx ON public.check_record USING btree (establishment_id);


--
-- Name: check_record_lapso_establishment_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_record_lapso_establishment_product_idx ON public.check_record USING btree (lapso_id, establishment_id, product_id);


--
-- Name: check_record_lapso_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_record_lapso_id_idx ON public.check_record USING btree (lapso_id);


--
-- Name: check_record_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_record_product_id_idx ON public.check_record USING btree (product_id);


--
-- Name: check_record_time_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_record_time_date_idx ON public.check_record USING btree (time_date);


--
-- Name: check_record_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_record_user_id_idx ON public.check_record USING btree (user_id);


--
-- Name: company_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_name_trgm_idx ON public.company USING gin (name extensions.gin_trgm_ops);


--
-- Name: establishment_route_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX establishment_route_id_idx ON public.establishment USING btree (route_id);


--
-- Name: evidence_record_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evidence_record_id_idx ON public.evidence USING btree (record_id);


--
-- Name: idx_audit_log_auth_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_auth_user_time ON public.audit_log USING btree (auth_user_id, performed_at DESC);


--
-- Name: idx_audit_log_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_performed_at ON public.audit_log USING btree (performed_at);


--
-- Name: idx_audit_log_table_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table_time ON public.audit_log USING btree (table_name, performed_at DESC);


--
-- Name: product_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_company_id_idx ON public.product USING btree (company_id);


--
-- Name: products_establishment_establishment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_establishment_establishment_id_idx ON public.products_establishment USING btree (establishment_id);


--
-- Name: products_establishment_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_establishment_product_id_idx ON public.products_establishment USING btree (product_id);


--
-- Name: route_assigned_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX route_assigned_user_idx ON public.route USING btree (assigned_user);


--
-- Name: route_lapso_lapso_user_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX route_lapso_lapso_user_unique_idx ON public.route_lapso USING btree (lapso_id, user_id);


--
-- Name: route_lapso_one_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX route_lapso_one_active_idx ON public.route_lapso USING btree (route_id, user_id) WHERE (status = 'en_curso'::public.route_lapso_status_enum);


--
-- Name: route_lapso_route_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX route_lapso_route_status_idx ON public.route_lapso USING btree (route_id, status, end_at DESC);


--
-- Name: route_lapso_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX route_lapso_user_status_idx ON public.route_lapso USING btree (user_id, status, end_at DESC);


--
-- Name: user_profile_auth_user_id_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_profile_auth_user_id_unique_idx ON public.user_profile USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: user_profile_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profile_company_id_idx ON public.user_profile USING btree (company_id);


--
-- Name: user_profile_email_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_profile_email_unique_idx ON public.user_profile USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: user_session_log_auth_user_id_login_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_session_log_auth_user_id_login_idx ON public.user_session_log USING btree (auth_user_id, login_at DESC);


--
-- Name: user_session_log_user_id_login_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_session_log_user_id_login_idx ON public.user_session_log USING btree (user_id, login_at DESC);


--
-- Name: user_tasks_task_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_tasks_task_id_idx ON public.user_tasks USING btree (task_id);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_iceberg_namespaces_bucket_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_namespaces_bucket_id ON storage.iceberg_namespaces USING btree (catalog_id, name);


--
-- Name: idx_iceberg_tables_location; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_location ON storage.iceberg_tables USING btree (location);


--
-- Name: idx_iceberg_tables_namespace_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_namespace_id ON storage.iceberg_tables USING btree (catalog_id, namespace_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: check_record trg_audit_check_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_check_record AFTER INSERT OR DELETE OR UPDATE ON public.check_record FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('record_id');


--
-- Name: company trg_audit_company; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_company AFTER INSERT OR DELETE OR UPDATE ON public.company FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('company_id');


--
-- Name: establishment trg_audit_establishment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_establishment AFTER INSERT OR DELETE OR UPDATE ON public.establishment FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('establishment_id');


--
-- Name: product trg_audit_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_product AFTER INSERT OR DELETE OR UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('product_id');


--
-- Name: route trg_audit_route; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_route AFTER INSERT OR DELETE OR UPDATE ON public.route FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('route_id');


--
-- Name: task trg_audit_task; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_task AFTER INSERT OR DELETE OR UPDATE ON public.task FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('task_id');


--
-- Name: user_profile trg_audit_user_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_user_profile AFTER INSERT OR DELETE OR UPDATE ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('user_id');


--
-- Name: user_tasks trg_audit_user_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_user_tasks AFTER INSERT OR DELETE OR UPDATE ON public.user_tasks FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log('task_id');


--
-- Name: evidence trg_enforce_max_evidence_per_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_max_evidence_per_record BEFORE INSERT OR UPDATE ON public.evidence FOR EACH ROW EXECUTE FUNCTION public.enforce_max_evidence_per_record();


--
-- Name: check_record trg_prevent_duplicate_check_record_per_active_lapso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_duplicate_check_record_per_active_lapso BEFORE INSERT ON public.check_record FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_check_record_per_active_lapso();


--
-- Name: user_profile trg_user_profile_protect_self_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_profile_protect_self_update BEFORE UPDATE ON public.user_profile FOR EACH ROW EXECUTE FUNCTION public.user_profile_protect_self_update();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id) ON DELETE SET NULL;


--
-- Name: check_record check_record_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_record
    ADD CONSTRAINT check_record_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishment(establishment_id);


--
-- Name: check_record check_record_lapso_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_record
    ADD CONSTRAINT check_record_lapso_user_fkey FOREIGN KEY (lapso_id, user_id) REFERENCES public.route_lapso(lapso_id, user_id) ON DELETE SET NULL;


--
-- Name: check_record check_record_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_record
    ADD CONSTRAINT check_record_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: check_record check_record_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_record
    ADD CONSTRAINT check_record_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id);


--
-- Name: establishment establishment_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishment
    ADD CONSTRAINT establishment_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.route(route_id);


--
-- Name: evidence evidence_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.check_record(record_id);


--
-- Name: product product_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id);


--
-- Name: products_establishment products_establishment_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_establishment
    ADD CONSTRAINT products_establishment_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishment(establishment_id);


--
-- Name: products_establishment products_establishment_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products_establishment
    ADD CONSTRAINT products_establishment_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(product_id);


--
-- Name: route route_assigned_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route
    ADD CONSTRAINT route_assigned_user_fkey FOREIGN KEY (assigned_user) REFERENCES public.user_profile(user_id);


--
-- Name: route_lapso route_lapso_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_lapso
    ADD CONSTRAINT route_lapso_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.route(route_id) ON DELETE CASCADE;


--
-- Name: route_lapso route_lapso_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_lapso
    ADD CONSTRAINT route_lapso_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id) ON DELETE CASCADE;


--
-- Name: user_profile user_profile_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_profile user_profile_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id) ON DELETE SET NULL;


--
-- Name: user_session_log user_session_log_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session_log
    ADD CONSTRAINT user_session_log_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_session_log user_session_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_session_log
    ADD CONSTRAINT user_session_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id) ON DELETE SET NULL;


--
-- Name: user_tasks user_tasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(task_id);


--
-- Name: user_tasks user_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profile(user_id);


--
-- Name: iceberg_namespaces iceberg_namespaces_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_namespace_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_namespace_id_fkey FOREIGN KEY (namespace_id) REFERENCES storage.iceberg_namespaces(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_insert_own ON public.audit_log FOR INSERT WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: audit_log audit_log_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select_admin_editor ON public.audit_log FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: audit_log audit_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select_own ON public.audit_log FOR SELECT USING ((auth.uid() = auth_user_id));


--
-- Name: check_record; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.check_record ENABLE ROW LEVEL SECURITY;

--
-- Name: check_record check_record_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_delete_admin ON public.check_record FOR DELETE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: check_record check_record_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_insert_admin ON public.check_record FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: check_record check_record_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_insert_admin_editor ON public.check_record FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: check_record check_record_insert_rutero_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_insert_rutero_own ON public.check_record FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = check_record.user_id)))));


--
-- Name: check_record check_record_insert_rutero_with_active_lapso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_insert_rutero_with_active_lapso ON public.check_record FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = check_record.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.route_lapso rl
  WHERE ((rl.lapso_id = check_record.lapso_id) AND (rl.user_id = check_record.user_id) AND (rl.status = 'en_curso'::public.route_lapso_status_enum))))));


--
-- Name: check_record check_record_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_select_admin ON public.check_record FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: check_record check_record_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_select_admin_editor ON public.check_record FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: check_record check_record_select_rutero_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_select_rutero_own ON public.check_record FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = check_record.user_id)))));


--
-- Name: check_record check_record_select_visitante_company_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_select_visitante_company_products ON public.check_record FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.product p
     JOIN public.user_profile up ON ((up.company_id = p.company_id)))
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'visitante'::public.user_role_enum) AND (p.product_id = check_record.product_id)))));


--
-- Name: check_record check_record_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_update_admin ON public.check_record FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: check_record check_record_update_rutero_with_active_lapso; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_record_update_rutero_with_active_lapso ON public.check_record FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = check_record.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.route_lapso rl
  WHERE ((rl.lapso_id = check_record.lapso_id) AND (rl.user_id = check_record.user_id) AND (rl.status = 'en_curso'::public.route_lapso_status_enum)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = check_record.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.route_lapso rl
  WHERE ((rl.lapso_id = check_record.lapso_id) AND (rl.user_id = check_record.user_id) AND (rl.status = 'en_curso'::public.route_lapso_status_enum))))));


--
-- Name: company; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

--
-- Name: company company_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_delete_admin ON public.company FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: company company_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_insert_admin_editor ON public.company FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: company company_select_admin_editor_visitante; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_select_admin_editor_visitante ON public.company FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum, 'visitante'::public.user_role_enum]))))));


--
-- Name: company company_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_update_admin_editor ON public.company FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: establishment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.establishment ENABLE ROW LEVEL SECURITY;

--
-- Name: establishment establishment_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY establishment_delete_admin ON public.establishment FOR DELETE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: establishment establishment_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY establishment_insert_admin_editor ON public.establishment FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: establishment establishment_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY establishment_select_admin_editor ON public.establishment FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: establishment establishment_select_rutero_assigned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY establishment_select_rutero_assigned ON public.establishment FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.route r
     JOIN public.user_profile up ON ((up.user_id = r.assigned_user)))
  WHERE ((r.route_id = establishment.route_id) AND (up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum)))));


--
-- Name: establishment establishment_select_visitante_company_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY establishment_select_visitante_company_products ON public.establishment FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.products_establishment pe
     JOIN public.product p ON ((p.product_id = pe.product_id)))
     JOIN public.user_profile up ON ((up.auth_user_id = auth.uid())))
  WHERE ((pe.establishment_id = establishment.establishment_id) AND (up.role = 'visitante'::public.user_role_enum) AND (up.company_id = p.company_id)))));


--
-- Name: establishment establishment_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY establishment_update_admin_editor ON public.establishment FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: evidence evidence_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_delete_admin ON public.evidence FOR DELETE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: evidence evidence_delete_admin_or_rutero_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_delete_admin_or_rutero_owner ON public.evidence FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_profile up
     JOIN public.check_record cr ON ((cr.record_id = evidence.record_id)))
  WHERE ((up.auth_user_id = auth.uid()) AND ((up.role = 'admin'::public.user_role_enum) OR ((up.role = 'rutero'::public.user_role_enum) AND (cr.user_id = up.user_id)))))));


--
-- Name: evidence evidence_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_insert_admin_editor ON public.evidence FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: evidence evidence_insert_admin_or_rutero_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_insert_admin_or_rutero_owner ON public.evidence FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_profile up
     JOIN public.check_record cr ON ((cr.record_id = evidence.record_id)))
  WHERE ((up.auth_user_id = auth.uid()) AND ((up.role = 'admin'::public.user_role_enum) OR ((up.role = 'rutero'::public.user_role_enum) AND (cr.user_id = up.user_id)))))));


--
-- Name: evidence evidence_insert_rutero_own_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_insert_rutero_own_records ON public.evidence FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.check_record cr
     JOIN public.user_profile up ON ((up.user_id = cr.user_id)))
  WHERE ((cr.record_id = evidence.record_id) AND (up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum)))));


--
-- Name: evidence evidence_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_select_admin_editor ON public.evidence FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: evidence evidence_select_admin_or_rutero_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_select_admin_or_rutero_owner ON public.evidence FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_profile up
     JOIN public.check_record cr ON ((cr.record_id = evidence.record_id)))
  WHERE ((up.auth_user_id = auth.uid()) AND ((up.role = 'admin'::public.user_role_enum) OR ((up.role = 'rutero'::public.user_role_enum) AND (cr.user_id = up.user_id)))))));


--
-- Name: evidence evidence_select_rutero_own_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_select_rutero_own_records ON public.evidence FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.check_record cr
     JOIN public.user_profile up ON ((up.user_id = cr.user_id)))
  WHERE ((cr.record_id = evidence.record_id) AND (up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum)))));


--
-- Name: evidence evidence_select_visitante_company_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_select_visitante_company_products ON public.evidence FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.check_record cr
     JOIN public.product p ON ((p.product_id = cr.product_id)))
     JOIN public.user_profile up ON ((up.company_id = p.company_id)))
  WHERE ((cr.record_id = evidence.record_id) AND (up.auth_user_id = auth.uid()) AND (up.role = 'visitante'::public.user_role_enum)))));


--
-- Name: evidence evidence_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_update_admin ON public.evidence FOR UPDATE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum)) WITH CHECK ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: product; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;

--
-- Name: product product_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_delete_admin ON public.product FOR DELETE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: product product_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_insert_admin_editor ON public.product FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: product product_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_select_admin_editor ON public.product FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: product product_select_rutero_assigned_route; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_select_rutero_assigned_route ON public.product FOR SELECT TO authenticated USING (public.is_rutero_assigned_to_product(product_id));


--
-- Name: product product_select_visitante_own_company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_select_visitante_own_company ON public.product FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'visitante'::public.user_role_enum) AND (up.company_id = product.company_id)))));


--
-- Name: product product_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_update_admin_editor ON public.product FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: products_establishment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products_establishment ENABLE ROW LEVEL SECURITY;

--
-- Name: products_establishment products_establishment_delete_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_establishment_delete_admin_editor ON public.products_establishment FOR DELETE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: products_establishment products_establishment_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_establishment_insert_admin_editor ON public.products_establishment FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: products_establishment products_establishment_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_establishment_select_admin_editor ON public.products_establishment FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: products_establishment products_establishment_select_rutero_assigned_route; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_establishment_select_rutero_assigned_route ON public.products_establishment FOR SELECT TO authenticated USING (public.is_rutero_assigned_to_establishment(establishment_id));


--
-- Name: products_establishment products_establishment_select_visitante_company_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_establishment_select_visitante_company_products ON public.products_establishment FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.product p
     JOIN public.user_profile up ON ((up.auth_user_id = auth.uid())))
  WHERE ((p.product_id = products_establishment.product_id) AND (up.role = 'visitante'::public.user_role_enum) AND (up.company_id = p.company_id)))));


--
-- Name: products_establishment products_establishment_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_establishment_update_admin_editor ON public.products_establishment FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: route; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.route ENABLE ROW LEVEL SECURITY;

--
-- Name: route route_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_delete_admin ON public.route FOR DELETE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: route route_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_insert_admin_editor ON public.route FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: route_lapso; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.route_lapso ENABLE ROW LEVEL SECURITY;

--
-- Name: route_lapso route_lapso_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_lapso_insert_admin ON public.route_lapso FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: route_lapso route_lapso_insert_rutero_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_lapso_insert_rutero_own ON public.route_lapso FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = route_lapso.user_id)))) AND (status = 'en_curso'::public.route_lapso_status_enum)));


--
-- Name: route_lapso route_lapso_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_lapso_select_admin ON public.route_lapso FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: route_lapso route_lapso_select_rutero_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_lapso_select_rutero_own ON public.route_lapso FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = route_lapso.user_id)))));


--
-- Name: route_lapso route_lapso_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_lapso_update_admin ON public.route_lapso FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: route_lapso route_lapso_update_rutero_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_lapso_update_rutero_own ON public.route_lapso FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = route_lapso.user_id)))) AND (status = 'en_curso'::public.route_lapso_status_enum))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = route_lapso.user_id)))) AND (status = ANY (ARRAY['en_curso'::public.route_lapso_status_enum, 'completado'::public.route_lapso_status_enum, 'incompleto'::public.route_lapso_status_enum]))));


--
-- Name: route route_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_select_admin_editor ON public.route FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: route route_select_rutero_assigned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_select_rutero_assigned ON public.route FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = route.assigned_user)))));


--
-- Name: route route_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY route_update_admin_editor ON public.route FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: task; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;

--
-- Name: task task_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_delete_admin ON public.task FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: task task_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_insert_admin ON public.task FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))));


--
-- Name: task task_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_select_admin_editor ON public.task FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: task task_select_rutero_assigned; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_select_rutero_assigned ON public.task FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.user_tasks ut
     JOIN public.user_profile up ON ((up.user_id = ut.user_id)))
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (ut.task_id = task.task_id)))));


--
-- Name: task task_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_update_admin_editor ON public.task FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: user_profile; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profile user_profile_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_delete_admin ON public.user_profile FOR DELETE TO authenticated USING ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: user_profile user_profile_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_insert_admin ON public.user_profile FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = 'admin'::public.user_role_enum));


--
-- Name: user_profile user_profile_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_select_admin_editor ON public.user_profile FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: user_profile user_profile_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_select_own ON public.user_profile FOR SELECT TO authenticated USING ((auth.uid() = auth_user_id));


--
-- Name: user_profile user_profile_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_update_admin_editor ON public.user_profile FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: user_profile user_profile_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profile_update_own ON public.user_profile FOR UPDATE TO authenticated USING ((auth.uid() = auth_user_id)) WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: user_session_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_session_log ENABLE ROW LEVEL SECURITY;

--
-- Name: user_session_log user_session_log_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_session_log_insert_own ON public.user_session_log FOR INSERT TO authenticated WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: user_session_log user_session_log_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_session_log_select_admin_editor ON public.user_session_log FOR SELECT TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])));


--
-- Name: user_session_log user_session_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_session_log_select_own ON public.user_session_log FOR SELECT TO authenticated USING ((auth.uid() = auth_user_id));


--
-- Name: user_session_log user_session_log_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_session_log_update_own ON public.user_session_log FOR UPDATE TO authenticated USING ((auth.uid() = auth_user_id)) WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: user_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_tasks user_tasks_delete_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_tasks_delete_admin_editor ON public.user_tasks FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: user_tasks user_tasks_insert_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_tasks_insert_admin_editor ON public.user_tasks FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: user_tasks user_tasks_select_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_tasks_select_admin_editor ON public.user_tasks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: user_tasks user_tasks_select_rutero_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_tasks_select_rutero_own ON public.user_tasks FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = user_tasks.user_id)))));


--
-- Name: user_tasks user_tasks_update_admin_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_tasks_update_admin_editor ON public.user_tasks FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = ANY (ARRAY['admin'::public.user_role_enum, 'editor'::public.user_role_enum]))))));


--
-- Name: user_tasks user_tasks_update_rutero_complete_pending; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_tasks_update_rutero_complete_pending ON public.user_tasks FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = user_tasks.user_id)))) AND (task_state = 'Pendiente'::public.task_state_enum))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'rutero'::public.user_role_enum) AND (up.user_id = user_tasks.user_id)))) AND (task_state = 'Completada'::public.task_state_enum)));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: objects check_evidences_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY check_evidences_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'check-evidences'::text) AND ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))) OR ((storage.foldername(name))[1] = (auth.uid())::text))));


--
-- Name: objects check_evidences_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY check_evidences_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'check-evidences'::text) AND ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))) OR ((storage.foldername(name))[1] = (auth.uid())::text))));


--
-- Name: objects check_evidences_select; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY check_evidences_select ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'check-evidences'::text) AND ((EXISTS ( SELECT 1
   FROM public.user_profile up
  WHERE ((up.auth_user_id = auth.uid()) AND (up.role = 'admin'::public.user_role_enum)))) OR ((storage.foldername(name))[1] = (auth.uid())::text))));


--
-- Name: iceberg_namespaces; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_namespaces ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_tables; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: objects profile_photos_delete_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY profile_photos_delete_own ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'profile-photos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects profile_photos_insert_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY profile_photos_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'profile-photos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects profile_photos_select_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY profile_photos_select_own ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'profile-photos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects profile_photos_update_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY profile_photos_update_own ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'profile-photos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'profile-photos'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

