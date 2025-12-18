extends Control

@onready var grid_container = $SafeMargin/VBoxContainer/GridArea/GridContainer
@onready var coins_label = $SafeMargin/VBoxContainer/TopBar/CoinPanel/Margin/HBox/CoinsLabel
@onready var buy_button = $BottomBar/Margin/HBox/BuyButton
@onready var shop_button = $BottomBar/Margin/HBox/ShopButton
@onready var settings_button = $BottomBar/Margin/HBox/SettingsButton

var item_scene = preload("res://scenes/MergeItem.tscn")
var slot_script = preload("res://scripts/Slot.gd")

var selected_item: MergeItem = null

func _ready():
	print("MainGame Ready")

	# Connect Buttons
	shop_button.pressed.connect(_on_shop_pressed)
	settings_button.pressed.connect(_on_settings_pressed)
	# Buy button connected via scene, but double checking in _on_buy_button_pressed

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
		slot.custom_minimum_size = Vector2(160, 160)
		slot.mouse_filter = Control.MOUSE_FILTER_PASS
		slot.set_script(slot_script)
		slot.index = i

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

		# Connect Click Signal
		item.clicked.connect(_on_item_clicked)

		return true
	return false

func _on_buy_button_pressed():
	print("Buy Button Pressed")
	_animate_button_press(buy_button)

	if GameManager.spend_coins(10) or GameManager.coins < 10:
		# Find empty slot
		for i in range(grid_container.get_child_count()):
			var slot = grid_container.get_child(i)
			if slot.get_child_count() == 0:
				_spawn_item_at(i, 1)
				GameManager.update_grid_state(i, 1)
				print("Spawned Item at ", i)
				break
	else:
		print("Not enough coins!")

func _on_shop_pressed():
	print("Shop Button Pressed")
	_animate_button_press(shop_button)

func _on_settings_pressed():
	print("Settings Button Pressed")
	_animate_button_press(settings_button)

func _on_item_clicked(item: MergeItem):
	print("Item Clicked Handler: ", item.level, " at ", item.grid_index)

	if selected_item == null:
		# Select new
		selected_item = item
		selected_item.set_selected(true)
		print("Selected Item at ", item.grid_index)

	elif selected_item == item:
		# Deselect self
		selected_item.set_selected(false)
		selected_item = null
		print("Deselected Item")

	else:
		# Interaction between selected and clicked
		if selected_item.level == item.level:
			_merge_items(selected_item, item)
			selected_item = null
		else:
			# Switch selection
			selected_item.set_selected(false)
			selected_item = item
			selected_item.set_selected(true)
			print("Switched Selection to ", item.grid_index)

func _merge_items(source: MergeItem, target: MergeItem):
	print("Merging items at ", source.grid_index, " and ", target.grid_index)

	var new_level = target.level + 1
	var target_index = target.grid_index
	var source_index = source.grid_index

	# Deselect visuals
	source.set_selected(false)
	target.set_selected(false)

	# Update Logic
	GameManager.remove_grid_item(source_index)
	GameManager.update_grid_state(target_index, new_level)

	# Remove Source
	source.queue_free()

	# Upgrade Target
	target.upgrade()

	print("Merge Complete. New Level: ", new_level)

func _on_coins_changed(amount):
	print("Coins Updated: ", amount)
	coins_label.text = "%d" % int(amount)
	var tween = create_tween()
	tween.tween_property(coins_label, "scale", Vector2(1.2, 1.2), 0.1)
	tween.tween_property(coins_label, "scale", Vector2.ONE, 0.1)

func _animate_button_press(btn: Button):
	var tween = create_tween()
	tween.tween_property(btn, "scale", Vector2(0.95, 0.95), 0.05)
	tween.tween_property(btn, "scale", Vector2.ONE, 0.05)
