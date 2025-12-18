extends Control

# Slot script attached to the Panel/ColorRect representing a grid cell.

@export var index: int = 0

func _ready():
	add_to_group("slots")

func get_item() -> MergeItem:
	if get_child_count() > 0:
		for child in get_children():
			if child is MergeItem:
				return child
	return null

func receive_drop(dropped_item: MergeItem):
	var current_item = get_item()

	# Case 1: Empty Slot -> Move
	if current_item == null:
		dropped_item.get_parent().remove_child(dropped_item)
		add_child(dropped_item)
		dropped_item.position = Vector2.zero

		# Update Data
		GameManager.remove_grid_item(dropped_item.grid_index)
		dropped_item.grid_index = index
		GameManager.update_grid_state(index, dropped_item.level)

	# Case 2: Occupied Slot
	else:
		if current_item == dropped_item:
			dropped_item.return_to_home() # Dropped on self
			return

		# Case 2A: Merge
		if current_item.level == dropped_item.level:
			# Merge!
			var new_level = current_item.level + 1

			# Remove dropped item
			dropped_item.queue_free()
			GameManager.remove_grid_item(dropped_item.grid_index)

			# Upgrade current
			current_item.level = new_level
			current_item.update_visuals()
			GameManager.update_grid_state(index, new_level)

		# Case 2B: Swap? (Optional, skipping for simplicity)
		else:
			dropped_item.return_to_home()
