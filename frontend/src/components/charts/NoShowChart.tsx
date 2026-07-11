import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type Props = {
    value: number;
};

export function NoShowChart({ value }: Props) {

    const data = [
        {
            name: "No Show",
            value,
        },
    ];

    return (
        <ResponsiveContainer width="100%" height={250}>

            <BarChart data={data}>

                <XAxis dataKey="name" />

                <YAxis
                    domain={[0,100]}
                />

                <Tooltip />

                <Bar
                    dataKey="value"
                    fill="#f59e0b"
                    radius={[8,8,0,0]}
                />

            </BarChart>

        </ResponsiveContainer>
    );

}