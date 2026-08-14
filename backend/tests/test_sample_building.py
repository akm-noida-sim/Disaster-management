"""Tests for the generated five-floor college sample."""

from app.services.sample_data import sample_building_graph


def test_sample_has_expected_floors_rooms_stairs_and_exits() -> None:
    sample = sample_building_graph()
    rooms = [node for node in sample.nodes if node.node_type.value == "room"]
    stairs = [node for node in sample.nodes if node.node_type.value == "stair"]
    exits = [node for node in sample.nodes if node.node_type.value == "exit"]

    assert len(sample.floors) == 5
    assert len(rooms) == 40
    assert len(stairs) == 20
    assert len(exits) == 4
    assert len(sample.edges) > 100
