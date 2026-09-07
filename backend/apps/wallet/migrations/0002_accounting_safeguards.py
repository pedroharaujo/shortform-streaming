from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION wallet_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Coin accounting history is immutable'
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER wallet_ledger_immutable
BEFORE UPDATE OR DELETE ON wallet_coinledgerentry
FOR EACH ROW EXECUTE FUNCTION wallet_reject_history_mutation();

CREATE TRIGGER wallet_unlock_immutable
BEFORE UPDATE OR DELETE ON wallet_coinunlock
FOR EACH ROW EXECUTE FUNCTION wallet_reject_history_mutation();

CREATE FUNCTION wallet_protect_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR
        (NEW.user_profile_id IS DISTINCT FROM OLD.user_profile_id
         AND NEW.user_profile_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Wallet identity can only be detached'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_identity_guard
BEFORE UPDATE ON wallet_wallet
FOR EACH ROW EXECUTE FUNCTION wallet_protect_identity();

CREATE FUNCTION wallet_guard_ledger_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    resulting_balance numeric;
BEGIN
    -- The write takes the wallet lock and changes its row version. Compared
    -- with SELECT FOR UPDATE alone, this also makes a stale REPEATABLE READ
    -- transaction fail serialization instead of summing an obsolete snapshot.
    UPDATE wallet_wallet SET id = id
    WHERE id = NEW.wallet_id AND user_profile_id IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot insert accounting for a missing or detached wallet'
            USING ERRCODE = '23514';
    END IF;

    -- This separate query receives a fresh snapshot at READ COMMITTED after
    -- waiting for the preceding wallet writer to commit.
    SELECT COALESCE(SUM(amount), 0) + NEW.amount INTO resulting_balance
    FROM wallet_coinledgerentry WHERE wallet_id = NEW.wallet_id;
    IF resulting_balance < 0 OR resulting_balance > 9007199254740991 THEN
        RAISE EXCEPTION 'Coin balance must remain between zero and the safe integer limit'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_ledger_insert_guard
BEFORE INSERT ON wallet_coinledgerentry
FOR EACH ROW EXECUTE FUNCTION wallet_guard_ledger_insert();

CREATE FUNCTION wallet_guard_unlock_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    owner_id bigint;
BEGIN
    SELECT user_profile_id INTO owner_id FROM wallet_wallet
    WHERE id = NEW.wallet_id FOR UPDATE;
    IF owner_id IS NULL THEN
        RAISE EXCEPTION 'Cannot insert accounting for a missing or detached wallet'
            USING ERRCODE = '23514';
    END IF;
    IF NEW.ledger_entry_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM wallet_coinledgerentry
        WHERE id = NEW.ledger_entry_id AND wallet_id = NEW.wallet_id
          AND kind = 'unlock' AND amount = -NEW.charged_coins::bigint
    ) THEN
        RAISE EXCEPTION 'Coin unlock receipt requires its matching wallet debit'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_unlock_insert_guard
BEFORE INSERT ON wallet_coinunlock
FOR EACH ROW EXECUTE FUNCTION wallet_guard_unlock_insert();
"""

REVERSE_SQL = """
DROP TRIGGER wallet_unlock_insert_guard ON wallet_coinunlock;
DROP FUNCTION wallet_guard_unlock_insert();
DROP TRIGGER wallet_ledger_insert_guard ON wallet_coinledgerentry;
DROP FUNCTION wallet_guard_ledger_insert();
DROP TRIGGER wallet_identity_guard ON wallet_wallet;
DROP FUNCTION wallet_protect_identity();
DROP TRIGGER wallet_unlock_immutable ON wallet_coinunlock;
DROP TRIGGER wallet_ledger_immutable ON wallet_coinledgerentry;
DROP FUNCTION wallet_reject_history_mutation();
"""


class Migration(migrations.Migration):
    dependencies = [("wallet", "0001_initial")]

    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
