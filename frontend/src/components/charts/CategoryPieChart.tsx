import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
} from "recharts";

type Props = {
    data: {
        name: string;
        value: number;
    }[];
};

const COLORS = [
    "#10263B",
    "#f59e0b",
    "#005A8C",
    "#C5D6E5",
    "#8C4F00",
    "#8C8800",
];

export function CategoryPieChart({ data }: Props) {
    return (
        <ResponsiveContainer
            width="100%"
            height={320}
        >
            <PieChart>
                <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                >
                    {data.map((_, index) => (
                        <Cell
                            key={index}
                            fill={COLORS[index % COLORS.length]}
                        />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}