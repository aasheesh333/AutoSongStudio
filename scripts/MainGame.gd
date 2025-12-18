extends Control

@onready var grid_container = $SafeMargin/VBoxContainer/GridArea/GridContainer
@onready var coins_label = $SafeMargin/VBoxContainer/TopBar/CoinPanel/Margin/HBox/CoinsLabel
@onready var buy_button = $BottomBar/Margin/HBox/BuyButton

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
		slot.custom_minimum_size = Vector2(160, 160) # Matched to item size + margin
		slot.mouse_filter = Control.MOUSE_FILTER_PASS
		slot.set_script(slot_script)
		slot.index = i

		# Invisible Style for Slot (Clean look, items float)
		var style = StyleBoxFlat.new()
		style.bg_color = Color(0.9, 0.9, 0.92, 0.5)
		style.set_corner_radius_all(24)
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
	_animate_button_press(buy_button)

	if GameManager.spend_coins(10) or GameManager.coins < 10:
		# Find empty slot
		for i in range(grid_container.get_child_count()):
			var slot = grid_container.get_child(i)
			if slot.get_child_count() == 0:
				_spawn_item_at(i, 1)
				GameManager.update_grid_state(i, 1)
				break

func _on_coins_changed(amount):
	coins_label.text = "%d" % int(amount)
	# Tiny pop animation on text
	var tween = create_tween()
	tween.tween_property(coins_label, "scale", Vector2(1.2, 1.2), 0.1)
	tween.tween_property(coins_label, "scale", Vector2.ONE, 0.1)

func _animate_button_press(btn: Button):
	var tween = create_tween()
	tween.tween_property(btn, "scale", Vector2(0.95, 0.95), 0.05)
	tween.tween_property(btn, "scale", Vector2.ONE, 0.05)
