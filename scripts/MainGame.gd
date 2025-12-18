extends Control

@onready var grid_container = $GridArea/GridContainer
@onready var coins_label = $TopHUD/CoinsLabel

var item_scene = preload("res://scenes/MergeItem.tscn")
var slot_script = preload("res://scripts/Slot.gd")

func _ready():
	_build_grid()
	GameManager.coins_changed.connect(_on_coins_changed)
	_on_coins_changed(GameManager.coins)

	# Restore State
	for idx in GameManager.grid_data:
		var level = GameManager.grid_data[idx]
		_spawn_item_at(idx, level)

func _build_grid():
	# 5x7 Grid
	var columns = 5
	var rows = 7
	grid_container.columns = columns

	for i in range(columns * rows):
		var slot = Panel.new()
		slot.custom_minimum_size = Vector2(180, 180) # Approximate for 1080 width
		slot.mouse_filter = Control.MOUSE_FILTER_PASS
		slot.set_script(slot_script)
		slot.index = i

		# Style
		var style = StyleBoxFlat.new()
		style.bg_color = Color(0.9, 0.9, 0.9)
		style.set_corner_radius_all(20)
		slot.add_theme_stylebox_override("panel", style)

		grid_container.add_child(slot)

func _spawn_item_at(index: int, level: int):
	var slot = grid_container.get_child(index)
	if slot.get_child_count() == 0:
		var item = item_scene.instantiate()
		slot.add_child(item)
		item.setup(level, index)
		return true
	return false

func _on_buy_button_pressed():
	if GameManager.spend_coins(10) or GameManager.coins < 10: # Charity logic preserved
		# Find empty slot
		for i in range(grid_container.get_child_count()):
			var slot = grid_container.get_child(i)
			if slot.get_child_count() == 0:
				_spawn_item_at(i, 1)
				GameManager.update_grid_state(i, 1)
				break

func _on_coins_changed(amount):
	coins_label.text = "Coins: %d" % int(amount)
