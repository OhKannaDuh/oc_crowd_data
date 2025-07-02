Template = require("Ferret/Templates/Template")

---@class TreasureHunt : Template
TreasureHunt = Template:extend()

function TreasureHunt:new()
	TreasureHunt.super.new(self, "TreasureHunt", Version(2, 9, 0))

	self.nodes = {
		Node(617.09, 66.3, -703.88),
		Node(490.41, 62.46, -590.57),
		Node(666.53, 79.12, -480.37),
		Node(870.66, 95.69, -388.36),
		Node(779.02, 96.09, -256.24),
		Node(726.28, 108.14, -67.92),
		Node(770.75, 107.99, -143.57),
		Node(788.88, 120.38, 109.39),
		Node(609.61, 107.99, 117.27),
		Node(475.73, 95.99, -87.08),
		Node(245.59, 109.12, -18.17),
		Node(354.12, 95.66, -288.93),
		Node(386.92, 96.79, -451.38),
		Node(381.73, 22.17, -743.65),
		Node(142.11, 16.4, -574.06),
		Node(-118.97, 4.99, -708.46),
		Node(-451.68, 2.98, -775.57),
		Node(-585.29, 4.99, -864.84),
		Node(-729.43, 4.99, -724.82),
		Node(-825.16, 2.98, -832.27),
		Node(-884.12, 3.8, -682.03),
		Node(-661.71, 2.98, -579.49),
		Node(-491.02, 2.98, -529.59),
		Node(-140.46, 22.35, -414.27),
		Node(-343.16, 52.32, -382.13),
		Node(55.28, 111.31, -289.08),
		Node(-158.65, 98.62, -132.74),
		Node(-487.11, 98.53, -205.46),
		Node(-444.11, 90.68, 26.23),
		Node(-394.89, 106.74, 175.43),
		Node(-682.8, 135.61, -195.27),
		Node(-729.92, 116.53, -79.06),
		Node(-756.83, 76.55, 97.37),
		Node(-713.8, 62.06, 192.61),
		Node(-648, 75, 403.95),
		Node(-401.66, 85.04, 332.54),
		Node(-283.99, 115.98, 377.04),
		Node(-256.89, 120.99, 125.08),
		Node(-25.68, 102.22, 150.16),
		Node(8.99, 103.2, 426.96),
		Node(277.79, 103.78, 241.9),
		Node(517.75, 67.89, 236.13),
		Node(642.97, 69.99, 407.8),
		Node(697.32, 69.99, 597.92),
		Node(835.08, 69.99, 699.09),
		Node(596.46, 70.3, 622.77),
		Node(433.71, 70.3, 683.53),
		Node(294.88, 56.08, 640.22),
		Node(471.18, 70.3, 530.02),
		Node(256.15, 73.17, 492.36),
		Node(140.98, 55.99, 770.99),
		Node(35.72, 65.11, 648.98),
		Node(-225.02, 75, 804.99),
		Node(-197.19, 74.91, 618.34),
		Node(-372.67, 75, 527.43),
	}

	self.pathfinding = Pathfinding()
end

function TreasureHunt:init()
	Template.init(self)

	return self
end

function TreasureHunt:setup()
	for _, node in ipairs(self.nodes) do
		self.pathfinding:add_node(node)
	end

	return true
end

function TreasureHunt:loop()
	local node = self.pathfinding:next()
	local timer = Timer()

	self.pathfinding:walk_to(node)

	repeat

	until Character:get_position():is_nearby(node, 1)

	self.pathfinding:wait_until_at_node(node)

	self.pathfinding:stop()

	repeat
		local halted = Character:has_target()

		local character = Character:get_position()
		local target = Character:get_target_position()

		if Character:has_target() and character:get_distance_to(target) <= 2 and not IsMoving() then
			Targetable(GetTargetName()):interact()
			halted = false
		end
		Wait:seconds(0.3)
	until not halted
end

local ferret = TreasureHunt():init()

ferret:start()
