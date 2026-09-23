-- Lets a buyer on a meet-up order report never receiving the card (the
-- seller never showed, or claimed a hand-over that never happened) without
-- an unboxing video — the only evidence a normal dispute requires, and
-- something a buyer who received nothing cannot honestly produce.
alter type dispute_reason add value if not exists 'not_received';
