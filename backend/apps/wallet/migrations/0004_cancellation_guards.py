from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION wallet_guard_terminal_unlock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- Serialize both terminal record types, including older application writers.
    -- A row-version change also rejects stale REPEATABLE READ snapshots.
    UPDATE wallet_wallet SET id = id
    WHERE id = NEW.wallet_id AND user_profile_id IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot resolve a missing or detached wallet'
            USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'wallet_coinunlock' THEN
        IF EXISTS (SELECT 1 FROM wallet_coinunlockcancellation
                   WHERE wallet_id = NEW.wallet_id AND request_id = NEW.request_id) THEN
            RAISE EXCEPTION 'A cancelled coin request cannot complete'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        IF EXISTS (SELECT 1 FROM wallet_coinunlock
                   WHERE wallet_id = NEW.wallet_id AND request_id = NEW.request_id) THEN
            RAISE EXCEPTION 'A completed coin request cannot be cancelled'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_unlock_cancellation_guard
BEFORE INSERT ON wallet_coinunlock
FOR EACH ROW EXECUTE FUNCTION wallet_guard_terminal_unlock();

CREATE TRIGGER wallet_cancellation_insert_guard
BEFORE INSERT ON wallet_coinunlockcancellation
FOR EACH ROW EXECUTE FUNCTION wallet_guard_terminal_unlock();

CREATE TRIGGER wallet_cancellation_immutable
BEFORE UPDATE OR DELETE ON wallet_coinunlockcancellation
FOR EACH ROW EXECUTE FUNCTION wallet_reject_history_mutation();
"""

REVERSE_SQL = """
DROP TRIGGER wallet_cancellation_immutable ON wallet_coinunlockcancellation;
DROP TRIGGER wallet_cancellation_insert_guard ON wallet_coinunlockcancellation;
DROP TRIGGER wallet_unlock_cancellation_guard ON wallet_coinunlock;
DROP FUNCTION wallet_guard_terminal_unlock();
"""


class Migration(migrations.Migration):
    dependencies = [("wallet", "0003_unlock_cancellation")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
