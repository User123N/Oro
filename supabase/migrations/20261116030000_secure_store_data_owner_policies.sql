-- Remove obsolete owner policies containing tautological tenant checks.
-- The remaining policies use private.owns_jewelry(tenant_id) for tenant-scoped writes
-- and restrict public reads to active storefronts.
DROP POLICY IF EXISTS store_data_owner_write ON public.jewelry_store_data;
DROP POLICY IF EXISTS store_data_public_read ON public.jewelry_store_data;
