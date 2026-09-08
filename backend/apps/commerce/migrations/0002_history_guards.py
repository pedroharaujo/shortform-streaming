from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION commerce_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Purchase history is immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER commerce_identity_immutable BEFORE UPDATE OR DELETE ON commerce_purchaseidentity
FOR EACH ROW EXECUTE FUNCTION commerce_reject_history_mutation();
CREATE TRIGGER commerce_binding_immutable BEFORE UPDATE OR DELETE ON commerce_applicationbinding
FOR EACH ROW EXECUTE FUNCTION commerce_reject_history_mutation();
CREATE TRIGGER commerce_decision_immutable BEFORE UPDATE OR DELETE ON commerce_purchasedecision
FOR EACH ROW EXECUTE FUNCTION commerce_reject_history_mutation();
CREATE TRIGGER commerce_event_immutable BEFORE UPDATE OR DELETE ON commerce_purchaseevent
FOR EACH ROW EXECUTE FUNCTION commerce_reject_history_mutation();

CREATE FUNCTION commerce_guard_credit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'credited' AND NOT EXISTS (
        SELECT 1 FROM wallet_coinledgerentry entry
        JOIN commerce_purchaseidentity identity ON identity.wallet_id = entry.wallet_id
        WHERE identity.id = NEW.identity_id AND entry.id = NEW.ledger_entry_id
          AND entry.kind = 'purchase' AND entry.amount = NEW.coins
          AND entry.reference = NEW.id
    ) THEN
        RAISE EXCEPTION 'Purchase receipt requires its matching wallet credit'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER commerce_credit_guard BEFORE INSERT ON commerce_purchasedecision
FOR EACH ROW EXECUTE FUNCTION commerce_guard_credit();
"""

REVERSE_SQL = """
DROP TRIGGER commerce_credit_guard ON commerce_purchasedecision;
DROP FUNCTION commerce_guard_credit();
DROP TRIGGER commerce_event_immutable ON commerce_purchaseevent;
DROP TRIGGER commerce_decision_immutable ON commerce_purchasedecision;
DROP TRIGGER commerce_identity_immutable ON commerce_purchaseidentity;
DROP TRIGGER commerce_binding_immutable ON commerce_applicationbinding;
DROP FUNCTION commerce_reject_history_mutation();
"""


class Migration(migrations.Migration):
    dependencies = [("commerce", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
